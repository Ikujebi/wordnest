import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly defaultFromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is missing from environment variables!');
    }
    
    // Initialize the Resend SDK
    this.resend = new Resend(apiKey);
    
    // Uses your verified sending subdomain routing configuration
    this.defaultFromAddress = process.env.EMAIL_FROM_DEFAULT || 'WordTabernacle <no-reply@send.wordtabernacle.org.ng>';
  }

  /**
   * Dispatches a single email transaction safely wrapped in error catch fields.
   */
  async send(options: SendEmailOptions): Promise<EmailResult> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      const payload: any = {
        from: options.from || this.defaultFromAddress,
        to: recipients,
        subject: options.subject,
        html: options.html,
      };

      if (options.cc) {
        payload.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
      }

      if (options.bcc) {
        payload.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
      }

      if (options.replyTo) {
        payload.reply_to = options.replyTo;
      }

      if (options.attachments?.length) {
        payload.attachments = options.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        }));
      }

      this.logger.log(`Initiating email dispatch via Resend to ${recipients.length} targets...`);

      const { data, error } = await this.resend.emails.send(payload);

      if (error) {
        this.logger.error(`Resend API Error: ${error.name} - ${error.message}`);
        return {
          success: false,
          error: error.message,
        };
      }

      this.logger.log(`Email successfully delivered. Message ID: ${data?.id}`);
      return {
        success: true,
        messageId: data?.id,
      };

    } catch (runtimeError: any) {
      this.logger.error(`Unexpected SMTP/API exception dropped: ${runtimeError.message}`, runtimeError.stack);
      return {
        success: false,
        error: runtimeError.message || 'Unknown third-party transactional runtime breakdown.',
      };
    }
  }

  /**
   * Bulk dispatch handling wrapper. It aggregates executions without blocking lines
   * so that one broken email syntax doesn't crash a whole batch run loop.
   */
  async sendBulk(batchOptions: SendEmailOptions[]): Promise<EmailResult[]> {
    this.logger.log(`Processing an array pipeline of ${batchOptions.length} asynchronous email tasks.`);
    
    const promises = batchOptions.map((option) => this.send(option));
    return Promise.all(promises);
  }
}