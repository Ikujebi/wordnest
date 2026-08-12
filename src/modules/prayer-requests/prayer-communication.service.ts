import { Injectable, Logger } from '@nestjs/common';
import { PrayerRequest } from '@prisma/client';

import { EmailService } from '../communications/channels/email.service';
import { prayerRequestReceivedTemplate } from './templates/prayer-request-received';
import { prayerRequestAssignedTemplate } from './templates/prayer-request-assigned';
import { prayerRequestAnsweredTemplate } from './templates/prayer-request-answered';
import { prayerTeamNoteTemplate } from './templates/prayer-team-note';
import { prayerFollowUpTemplate } from './templates/prayer-follow-up';

@Injectable()
export class PrayerCommunicationService {
  private readonly logger = new Logger(PrayerCommunicationService.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Safe helper to extract error message from unknown catch variables
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /**
   * Safe helper to extract error stack trace from unknown catch variables
   */
  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  /**
   * Send confirmation after a user submits a prayer request
   */
  async sendRequestReceivedEmail(prayer: PrayerRequest): Promise<void> {
    if (!prayer.email) {
      this.logger.warn(`Prayer request ${prayer.id} has no email address`);
      return;
    }

    try {
      const template = prayerRequestReceivedTemplate({
        firstName: prayer.firstName || 'Friend',
        subject: prayer.subject,
      });

      await this.emailService.send({
        to: prayer.email,
        subject: template.subject,
        html: template.html,
      });

      this.logger.log(`Prayer received email sent to ${prayer.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send request received email for prayer ID ${prayer.id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    }
  }

  /**
   * Notify requester when prayer request has been assigned to a prayer worker
   */
  async sendAssignedEmail(
    prayer: PrayerRequest,
    assignedToName: string,
  ): Promise<void> {
    if (!prayer.email) {
      this.logger.warn(`Prayer request ${prayer.id} has no email address`);
      return;
    }

    try {
      const template = prayerRequestAssignedTemplate({
        requesterName: prayer.firstName || 'Friend',
        prayerSubject: prayer.subject,
        assignedToName,
      });

      await this.emailService.send({
        to: prayer.email,
        subject: template.subject,
        html: template.html,
      });

      this.logger.log(`Prayer assignment email sent to ${prayer.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send assignment email for prayer ID ${prayer.id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    }
  }

  /**
   * Send answered prayer testimony email
   */
  async sendAnsweredEmail(prayer: PrayerRequest): Promise<void> {
    if (!prayer.email) {
      this.logger.warn(`Prayer request ${prayer.id} has no email address`);
      return;
    }

    try {
      const template = prayerRequestAnsweredTemplate({
        firstName: prayer.firstName || 'Friend',
        prayerSubject: prayer.subject,
        testimony: prayer.testimony || undefined,
      });

      await this.emailService.send({
        to: prayer.email,
        subject: template.subject,
        html: template.html,
      });

      this.logger.log(`Answered prayer email sent to ${prayer.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send answered prayer email for prayer ID ${prayer.id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    }
  }

  /**
   * Send a personal message from prayer team/pastor
   */
  async sendPrayerTeamNoteEmail(
    prayer: PrayerRequest,
    message: string,
    senderName?: string,
  ): Promise<void> {
    if (!prayer.email) {
      this.logger.warn(`Prayer request ${prayer.id} has no email address`);
      return;
    }

    try {
      const template = prayerTeamNoteTemplate({
        firstName: prayer.firstName || 'Friend',
        prayerSubject: prayer.subject,
        message,
        senderName,
      });

      await this.emailService.send({
        to: prayer.email,
        subject: template.subject,
        html: template.html,
      });

      this.logger.log(`Prayer team note sent to ${prayer.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send prayer team note email for prayer ID ${prayer.id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    }
  }

  /**
   * Automated pastoral follow-up
   */
  async sendFollowUpEmail(prayer: PrayerRequest): Promise<void> {
    if (!prayer.email) {
      this.logger.warn(`Prayer request ${prayer.id} has no email address`);
      return;
    }

    try {
      const template = prayerFollowUpTemplate({
        firstName: prayer.firstName || 'Friend',
        prayerSubject: prayer.subject,
      });

      await this.emailService.send({
        to: prayer.email,
        subject: template.subject,
        html: template.html,
      });

      this.logger.log(`Prayer follow-up sent to ${prayer.email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send follow-up email for prayer ID ${prayer.id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    }
  }

  /**
   * Notify prayer team members internally
   */
  async notifyPrayerTeam(
    prayer: PrayerRequest,
    teamEmails: string[],
  ): Promise<void> {
    if (!teamEmails || teamEmails.length === 0) {
      this.logger.warn(
        `No team emails provided for prayer notification ${prayer.id}`,
      );
      return;
    }

    try {
      const emails = teamEmails.map((email) => ({
        to: email,
        subject: `New Prayer Request - ${prayer.subject}`,
        html: `
          <h2>New Prayer Request Received</h2>
          <p><strong>Name:</strong> ${prayer.firstName || ''} ${
            prayer.lastName || ''
          }</p>
          <p><strong>Subject:</strong> ${prayer.subject}</p>
          <p>${prayer.message}</p>
        `,
      }));

      await this.emailService.sendBulk(emails);
      this.logger.log(
        `Prayer team notified (${teamEmails.length} recipients)`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to notify prayer team for prayer ID ${prayer.id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
    }
  }
}