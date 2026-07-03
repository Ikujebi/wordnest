import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly resend: Resend;

  constructor(
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(
      this.config.getOrThrow('RESEND_API_KEY'),
    );
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ) {
    try {
      await this.resend.emails.send({
        from: this.config.getOrThrow('EMAIL_FROM'),
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}