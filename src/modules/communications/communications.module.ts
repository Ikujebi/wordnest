import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { BullModule } from '@nestjs/bullmq';
import { RedisQueueModule } from '../../config/redis.config';
import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { SmsQueueService } from './channels/sms/sms.queue';
import { SmsProcessor } from './channels/sms/sms.processor'
import { WebPushService } from './channels/push.service';
import { SchedulerService } from './channels/scheduler.service';

@Module({
  imports: [PrismaModule,  RedisQueueModule,

    BullModule.registerQueue({
      name: 'sms',
    }),],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    EmailService,
    SmsService,
    SmsQueueService,
    SmsProcessor,
    WebPushService,
    SchedulerService,
  ],
  exports: [
    CommunicationsService,
    EmailService,
    SmsService,
    WebPushService,
  ],
})
export class CommunicationsModule {}