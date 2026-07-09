import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunicationChannel, RecipientStatus } from '@prisma/client';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly prisma: PrismaService) {
    // TODO: Initialize your SMS gateway provider (e.g., Twilio, Termii, Africa's Talking)
  }

  /**
   * Send SMS to a single recipient and log the result.
   */
  async sendSms(
    communicationId: string,
    recipientId: string,
    phoneNumber: string,
    content: string,
  ): Promise<boolean> {
    if (!phoneNumber) {
      await this.updateRecipientStatus(recipientId, RecipientStatus.FAILED);
      await this.logDelivery(communicationId, false, 'Missing phone number');
      return false;
    }

    try {
      this.logger.debug(`Sending SMS to ${phoneNumber}...`);
      
      // ----------------------------------------------------------------
      // 🔥 REPLACE THIS WITH YOUR ACTUAL SMS PROVIDER SDK CALL
      // Example (Termii/Twilio):
      // const response = await this.smsProvider.send({ to: phoneNumber, message: content });
      // ----------------------------------------------------------------
      
      const providerResponse = 'SMS successfully dispatched to gateway'; 

      // Update recipient state to SENT
      await this.updateRecipientStatus(recipientId, RecipientStatus.SENT);

      // Log successful transaction
      await this.logDelivery(communicationId, true, providerResponse);

      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`SMS delivery failed to ${phoneNumber}`, err.stack);

      // Update recipient state to FAILED
      await this.updateRecipientStatus(recipientId, RecipientStatus.FAILED);

      // Log transaction failure
      await this.logDelivery(communicationId, false, err.message || 'Unknown SMS Provider Error');

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
        channel: CommunicationChannel.SMS,
        success,
        response,
      },
    });
  }
}