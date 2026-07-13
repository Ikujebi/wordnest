import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendEmailOptions, EmailTemplatePayload } from './email.types';
import { EmailTemplates } from './email.templates';

@Injectable()
export class EmailQueue {
  private readonly logger = new Logger(EmailQueue.name);

  constructor(@InjectQueue('email') private readonly queue: Queue) {}

  /**
   * Pushes a single, transactional email onto the queue
   */
  async addRawJob(options: SendEmailOptions) {
    return this.queue.add('send-email', options, {
      attempts: 5,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  /**
   * Triggers a mass broadcast worker cycle for a parent Communication ID
   */
  async addBroadcastJob(communicationId: string) {
    this.logger.log(`Enqueuing bulk broadcast processing flow for Communication: ${communicationId}`);
    return this.queue.add(
      'process-broadcast', 
      { communicationId },
      {
        attempts: 2,
        removeOnComplete: 500,
        removeOnFail: 1000,
      }
    );
  }

  async addTemplateJob<T extends keyof EmailTemplatePayload>(
    to: string | string[],
    template: T,
    data: EmailTemplatePayload[T],
    extraOptions?: Partial<Omit<SendEmailOptions, 'to' | 'subject' | 'html'>>
  ) {
    const rendered = EmailTemplates.render(template, data);
    return this.addRawJob({
      to,
      subject: rendered.subject,
      html: rendered.html,
      ...extraOptions,
    });
  }
}