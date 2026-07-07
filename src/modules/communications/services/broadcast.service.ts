import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';

import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import { PushService } from '../channels/push.service';
import { WhatsappService } from '../channels/whatsapp.service';

import {
  CommunicationChannel,
} from '../enums/communication-channel.enum';

import {
  CommunicationStatus,
} from '../enums/communication-status.enum';


@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);


  constructor(
    private readonly prisma: PrismaService,

    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly pushService: PushService,
    private readonly whatsappService: WhatsappService,
  ) {}


  /**
   * Send communication broadcast
   */
  async send(
    communicationId: string,
  ) {

    const communication =
      await this.prisma.communication.findUnique({
        where: {
          id: communicationId,
        },

        include: {
          recipients: true,
        },
      });


    if (!communication) {
      throw new BadRequestException(
        'Communication not found',
      );
    }


    if (
      communication.status ===
      CommunicationStatus.SENT
    ) {
      throw new BadRequestException(
        'Communication already sent',
      );
    }


    await this.prisma.communication.update({
      where: {
        id: communicationId,
      },

      data: {
        status: CommunicationStatus.SENDING,
      },
    });



    let successful = 0;
    let failed = 0;



    try {


      for (
        const recipient of communication.recipients
      ) {


        for (
          const channel of communication.channels
        ) {


          try {


            await this.sendThroughChannel(
              channel,
              {
                recipient,
                communication,
              },
            );


            await this.createLog({
              communicationId,
              recipientId: recipient.id,
              channel,
              success: true,
            });


            successful++;


          } catch(error) {


            failed++;


            await this.createLog({
              communicationId,
              recipientId: recipient.id,
              channel,
              success:false,
              response:
                error.message,
            });


            this.logger.error(
              `Failed sending ${channel}`,
              error,
            );

          }

        }

      }



      await this.prisma.communication.update({

        where:{
          id:communicationId,
        },


        data:{
          status:
            CommunicationStatus.SENT,

          sentAt:
            new Date(),
        },

      });



      return {

        message:
          'Broadcast completed',

        successful,

        failed,

      };


    } catch(error){


      await this.prisma.communication.update({

        where:{
          id:communicationId,
        },

        data:{
          status:
            CommunicationStatus.FAILED,
        },

      });



      this.logger.error(
        'Broadcast failed',
        error,
      );


      throw new InternalServerErrorException(
        'Unable to send broadcast',
      );

    }

  }



  /**
   * Send using selected channel
   */
  private async sendThroughChannel(
    channel: CommunicationChannel,
    data:any,
  ){


    switch(channel){


      case CommunicationChannel.EMAIL:

        return this.emailService.send({
          email:
            data.recipient.email,

          subject:
            data.communication.subject,

          content:
            data.communication.content,
        });



      case CommunicationChannel.SMS:

        return this.smsService.send({
          phone:
            data.recipient.phone,

          message:
            data.communication.content,
        });



      case CommunicationChannel.PUSH:

        return this.pushService.send({
          userId:
            data.recipient.memberId,

          title:
            data.communication.title,

          message:
            data.communication.content,
        });



      case CommunicationChannel.WHATSAPP:

        return this.whatsappService.send({
          phone:
            data.recipient.phone,

          message:
            data.communication.content,
        });



      default:

        throw new Error(
          `Unsupported channel ${channel}`,
        );

    }

  }





  /**
   * Save delivery log
   */
  private async createLog(
    data:{
      communicationId:string;
      recipientId:string;
      channel:CommunicationChannel;
      success:boolean;
      response?:string;
    },
  ){


    return this.prisma.communicationLog.create({

      data:{

        communicationId:
          data.communicationId,

        recipientId:
          data.recipientId,


        channel:
          data.channel,


        success:
          data.success,


        response:
          data.response,

      },

    });


  }





  /**
   * Retry failed broadcast
   */
  async retryFailed(
    communicationId:string,
  ){

    const failedRecipients =
      await this.prisma.communicationLog.findMany({

        where:{
          communicationId,

          success:false,
        },

      });


    if(!failedRecipients.length){

      return {
        message:
          'No failed deliveries found',
      };

    }


    return this.send(
      communicationId,
    );

  }



}