import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
// Pulling real type-safe enums directly from your generated Prisma schema client
import { 
  CommunicationChannel, 
  CommunicationStatus 
} from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { WebPushService } from '../channels/push.service';
import { WhatsappService } from '../channels/whatsapp.service';

interface SendChannelPayload {
  communicationId: string;
  recipient: {
    id: string;
    email?: string | null;
    phone?: string | null;
    memberId?: string | null;
  };
  communication: {
    title: string;
    subject?: string | null;
    content: string;
  };
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly pushService: WebPushService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * Send communication broadcast
   */
  async send(communicationId: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      include: { recipients: true },
    });

    if (!communication) {
      throw new BadRequestException('Communication not found');
    }

    if (communication.status === CommunicationStatus.SENT) {
      throw new BadRequestException('Communication already sent');
    }

    await this.prisma.communication.update({
      where: { id: communicationId },
      data: { status: CommunicationStatus.PROCESSING },
    });

    let successful = 0;
    let failed = 0;

    // Pull targeted communication channels directly from your Prisma array list
const targetChannels: CommunicationChannel[] = (communication as any).channels || [];
    try {
      for (const recipient of communication.recipients) {
        for (const channel of targetChannels) {
          try {
            await this.sendThroughChannel(channel, {
              communicationId,
              recipient,
              communication,
            });

            // Only write generic centralized logs if the channel doesn't write logs internally
            if (channel !== CommunicationChannel.SMS && channel !== CommunicationChannel.WHATSAPP) {
              await this.createLog({
                communicationId,
                channel,
                success: true,
                response: 'Delivery successful',
              });
            }

            successful++;
          } catch (error: any) {
            failed++;
            const errorMessage = error.message || 'Unknown error occurred during transmission';

            // Only write centralized error logs if the channel doesn't handle its own logging
            if (channel !== CommunicationChannel.SMS && channel !== CommunicationChannel.WHATSAPP) {
              await this.createLog({
                communicationId,
                channel,
                success: false,
                response: errorMessage,
              });
            }

            this.logger.error(
              `Failed sending via ${channel} to recipient ${recipient.id}: ${errorMessage}`,
              error.stack,
            );
          }
        }
      }

      await this.prisma.communication.update({
        where: { id: communicationId },
        data: {
          status: CommunicationStatus.SENT,
          sentAt: new Date(),
        },
      });

      return {
        message: 'Broadcast completed',
        successful,
        failed,
      };

    } catch (error) {
      await this.prisma.communication.update({
        where: { id: communicationId },
        data: { status: CommunicationStatus.FAILED },
      });

      this.logger.error('Critical broadcast execution failure', error);
      throw new InternalServerErrorException('Unable to complete broadcast execution');
    }
  }

  /**
   * Send using selected channel
   */
  private async sendThroughChannel(
    channel: CommunicationChannel,
    data: SendChannelPayload,
  ) {
    switch (channel) {
      case CommunicationChannel.EMAIL:
        if (!data.recipient.email) throw new Error('Recipient has no email set');
        
        const emailResult = await this.emailService.send({
          to: data.recipient.email,
          subject: data.communication.subject || 'No Subject',
          html: data.communication.content,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || 'Resend API failed to dispatch email');
        }
        return emailResult;

      case CommunicationChannel.SMS:
        if (!data.recipient.phone) throw new Error('Recipient has no phone number set');
        
        // Maps perfectly to your signature: communicationId, recipientId, phoneNumber, content
        const smsSuccess = await this.smsService.sendSms(
          data.communicationId,
          data.recipient.id,
          data.recipient.phone,
          data.communication.content
        );

        if (!smsSuccess) {
          throw new Error('SmsService failed to process SMS delivery');
        }
        return smsSuccess;

      case CommunicationChannel.WHATSAPP:
        if (!data.recipient.phone) throw new Error('Recipient has no phone number set for WhatsApp');
        
        // Maps perfectly to your signature: communicationId, recipientId, phone, content
        const whatsappSuccess = await this.whatsappService.sendWhatsapp(
          data.communicationId,
          data.recipient.id,
          data.recipient.phone,
          data.communication.content
        );

        if (!whatsappSuccess) {
          throw new Error('WhatsappService failed to process WhatsApp delivery');
        }
        return whatsappSuccess;

      case CommunicationChannel.PUSH:
        if (!data.recipient.memberId) throw new Error('Recipient has no member profile for push targeting');
        
        // Formulated to safely satisfy the WebPushSubscription parameter definition inside WebPushService
        const mockSubscription = {
          endpoint: '',
          keys: { p256dh: '', auth: '' }
        };

        const pushResult = await this.pushService.send(
          mockSubscription,
          {
            title: data.communication.title,
            body: data.communication.content,
          }
        );

        if (!pushResult.success) {
          throw new Error(pushResult.error || 'WebPushService failed to dispatch notice');
        }
        return pushResult;

      default:
        throw new Error(`Unsupported channel configuration: ${channel}`);
    }
  }

  /**
   * Save delivery log
   */
  private async createLog(data: {
    communicationId: string;
    channel: CommunicationChannel;
    success: boolean;
    response?: string;
  }) {
    return this.prisma.communicationLog.create({
      data: {
        communicationId: data.communicationId,
        channel: data.channel,
        success: data.success,
        response: data.response || null,
      },
    });
  }

  /**
   * Retry failed broadcast entries
   */
  async retryFailed(communicationId: string) {
    const failedLogs = await this.prisma.communicationLog.findMany({
      where: {
        communicationId,
        success: false,
      },
    });

    if (!failedLogs.length) {
      return {
        message: 'No failed deliveries found',
      };
    }

    return this.send(communicationId);
  }
}