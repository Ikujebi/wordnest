import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunicationChannel, RecipientStatus } from '@prisma/client';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.getOrThrow<string>('WHATSAPP_API_URL');
    this.phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
  }

  /**
   * Normalizes a Nigerian-format number (0801..., +234801...) into the
   * international digits-only format the WhatsApp Cloud API requires
   * (e.g. 234801xxxxxxx, no +, no leading 0).
   */
  private normalizePhone(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.startsWith('234')) return digitsOnly;
    if (digitsOnly.startsWith('0')) return `234${digitsOnly.slice(1)}`;
    return digitsOnly;
  }

  async sendWhatsapp(
    communicationId: string,
    recipientId: string,
    phone: string,
    content: string,
    mediaUrl?: string,
  ): Promise<boolean> {
    if (!phone) {
      await this.updateRecipientStatus(recipientId, RecipientStatus.FAILED);
      await this.logDelivery(communicationId, false, 'Missing WhatsApp phone number');
      return false;
    }

    const to = this.normalizePhone(phone);

    try {
      this.logger.debug(`Sending WhatsApp message to ${to}${mediaUrl ? ' with media' : ''}...`);

      const payload = mediaUrl
        ? {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: { link: mediaUrl, caption: content },
          }
        : {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: content, preview_url: true },
          };

      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.error?.message || `WhatsApp API responded with ${response.status}`;
        throw new Error(errorMessage);
      }

      const messageId = data?.messages?.[0]?.id ?? 'unknown';

      await this.updateRecipientStatus(recipientId, RecipientStatus.SENT);
      await this.logDelivery(communicationId, true, `WhatsApp message sent (id: ${messageId})`);

      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`WhatsApp delivery failed to ${to}`, err.stack);

      await this.updateRecipientStatus(recipientId, RecipientStatus.FAILED);
      await this.logDelivery(communicationId, false, err.message || 'Unknown WhatsApp Provider Error');

      return false;
    }
  }

  private async updateRecipientStatus(recipientId: string, status: RecipientStatus) {
    await this.prisma.communicationRecipient.update({
      where: { id: recipientId },
      data: {
        status,
        sentAt: status === RecipientStatus.SENT ? new Date() : undefined,
      },
    });
  }

  private async logDelivery(communicationId: string, success: boolean, response: string) {
    await this.prisma.communicationLog.create({
      data: {
        communicationId,
        channel: CommunicationChannel.WHATSAPP,
        success,
        response,
      },
    });
  }
}