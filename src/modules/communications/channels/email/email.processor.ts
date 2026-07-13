import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { EmailService } from './email.service';
import { SendEmailOptions } from './email.types';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'send-email':
        return this.handleSendEmail(job.data);

      case 'process-broadcast':
        return this.handleProcessBroadcast(job.data.communicationId);

      default:
        this.logger.warn(`Unregistered job type detected on cluster queue: ${job.name}`);
    }
  }

  private async handleSendEmail(data: SendEmailOptions) {
    const result = await this.emailService.send(data);
    if (!result.success) {
      throw new Error(`Transactional email job step failure: ${result.error}`);
    }
    return result;
  }

  private async handleProcessBroadcast(communicationId: string) {
    this.logger.log(`Starting execution metrics collection for broadcast: ${communicationId}`);

    // 1. Fetch parent metadata & update status to PROCESSING
    const communication = await this.prisma.communication.update({
      where: { id: communicationId },
      data: { status: 'PROCESSING' },
    });

    // Extract the banner image safely from the Prisma JSON field
    const metadata = communication.metadata as Record<string, any> | null;
    const bannerImageUrl = metadata?.bannerImageUrl ?? null;

    // 2. Inject the image dynamically into the template layout if it exists
    let finalHtml = communication.content;
    if (bannerImageUrl) {
      finalHtml = `
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="${bannerImageUrl}" alt="Broadcast Banner" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto;" />
        </div>
        ${communication.content}
      `;
    }

    let skip = 0;
    let hasMore = true;

    // 3. Paginate over targets in small database chunks
    while (hasMore) {
      const recipients = await this.prisma.communicationRecipient.findMany({
        where: { 
          communicationId,
          status: 'PENDING',
          email: { not: null }
        },
        take: this.BATCH_SIZE,
        skip: skip,
      });

      if (recipients.length === 0) {
        hasMore = false;
        break;
      }

      // 4. Process the chunk in parallel using Promise.allSettled
      await Promise.allSettled(
        recipients.map(async (recipient) => {
          if (!recipient.email) return;

          const result = await this.emailService.send({
            communicationId: communication.id,
            to: recipient.email,
            subject: communication.subject ?? communication.title,
            html: finalHtml, // Sending content with the integrated image element
          });

          // 5. Update individual recipient delivery markers
          await this.prisma.communicationRecipient.update({
            where: { id: recipient.id },
            data: {
              status: result.success ? 'SENT' : 'FAILED',
              sentAt: result.success ? new Date() : null,
            },
          });
        })
      );

      if (recipients.length < this.BATCH_SIZE) {
        hasMore = false;
      } else {
        skip += this.BATCH_SIZE;
      }
    }

    // 6. Conclude operational run lifecycle markers
    await this.prisma.communication.update({
      where: { id: communicationId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    this.logger.log(`Completed broadcasting execution engine parameters successfully for ID: ${communicationId}`);
    return { communicationId, status: 'COMPLETED' };
  }
}