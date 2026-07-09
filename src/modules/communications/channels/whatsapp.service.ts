import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunicationChannel, RecipientStatus } from '@prisma/client';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {
    // TODO: Initialize your WhatsApp Business API client or wrapper (e.g., Twilio WhatsApp, Meta Graph API, Termii WhatsApp)
  }

  /**
   * Send WhatsApp message to a single recipient and log the tracking status.
   */
  async sendWhatsapp(
    communicationId: string,
    recipientId: string,
    phone: string,
    content: string,
  ): Promise<boolean> {
    if (!phone) {
      await this.updateRecipientStatus(recipientId, RecipientStatus.FAILED);
      await this.logDelivery(communicationId, false, 'Missing WhatsApp phone number');
      return false;
    }

    try {
      this.logger.debug(`Sending WhatsApp message to ${phone}...`);

      // ----------------------------------------------------------------
      // 🔥 REPLACE THIS WITH YOUR BUSINESS WHATSAPP PROVIDER SDK / HTTP CALL
      // Example (Meta Graph API / Twilio WhatsApp):
      // const response = await this.whatsappClient.messages.create({ 
      //   to: `whatsapp:${phone}`, 
      //   body: content 
      // });
      // ----------------------------------------------------------------

      const providerResponse = 'WhatsApp message dispatched to provider queue';

      // Update recipient state to SENT
      await this.updateRecipientStatus(recipientId, RecipientStatus.SENT);

      // Log successful transaction
      await this.logDelivery(communicationId, true, providerResponse);

      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`WhatsApp delivery failed to ${phone}`, err.stack);

      // Update recipient state to FAILED
      await this.updateRecipientStatus(recipientId, RecipientStatus.FAILED);

      // Log transaction failure
      await this.logDelivery(communicationId, false, err.message || 'Unknown WhatsApp Provider Error');

      return false;
    }
  }

  /**
   * Helper to update transaction status on the recipient model.
   */
  private async updateRecipientStatus(recipientId: string, status: RecipientStatus) {
    await this.prisma.communicationRecipient.update({
      where: { id: recipientId },
      data: {
        status,
        sentAt: status === RecipientStatus.SENT ? new Date() : undefined,
      },
    });
  }

  /**
   * Helper to write records to the CommunicationLog table.
   */
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