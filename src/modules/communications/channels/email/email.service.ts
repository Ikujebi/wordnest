
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Resend, CreateEmailOptions } from 'resend';
import { PrismaService } from '../../../../../prisma/prisma.service';

export interface SendEmailOptions {
  communicationId?: string;
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

    this.resend = new Resend(apiKey);
    this.defaultFrom =
      this.config.get<string>('EMAIL_FROM_DEFAULT') ??
      'WordTabernacle <no-reply@send.wordtabernacle.org.ng>';
  }

  async queueEmail(options: SendEmailOptions) {
    return this.emailQueue.add('send-email', options, {
      attempts: 5,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async send(options: SendEmailOptions) {
    const payload: CreateEmailOptions = {
      from: options.from ?? this.defaultFrom,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
    };

    try {
      const { data, error } = await this.resend.emails.send(payload);

      if (error) {
        await this.log(options.communicationId, false, error.message);
        return { success: false, error: error.message };
      }

      await this.log(options.communicationId, true, data?.id ?? '');
      return { success: true, messageId: data?.id };
    } catch (e: any) {
      this.logger.error(e.message, e.stack);
      await this.log(options.communicationId, false, e.message);
      return { success: false, error: e.message };
    }
  }

  async sendBulk(batch: SendEmailOptions[]) {
    return Promise.all(batch.map((b) => this.queueEmail(b)));
  }

  private async log(
    communicationId: string | undefined,
    success: boolean,
    response: string,
  ) {
    if (!communicationId) return;

    await this.prisma.communicationLog.create({
      data: {
        communicationId,
        channel: 'EMAIL' as any,
        success,
        response,
      },
    });
  }
}
