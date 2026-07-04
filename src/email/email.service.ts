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
      this.config.getOrThrow<string>('RESEND_API_KEY'),
    );
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.getOrThrow<string>('EMAIL_FROM'),
        to: [to],
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          `Failed to send email to ${to}: ${error.message}`,
        );
        throw new Error(error.message);
      }

      this.logger.log(
        `Email sent successfully to ${to}. Email ID: ${data?.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Unexpected error sending email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}