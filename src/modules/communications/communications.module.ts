import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '../../prisma/prisma.module';
import { RedisQueueModule } from '../../config/redis.config';

import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { WhatsappService } from './channels/whatsapp.service';
import { WebPushService } from './channels/push.service';
import { SchedulerService } from './channels/scheduler.service';

import { SmsQueueService } from './channels/sms/sms.queue';
import { SmsProcessor } from './channels/sms/sms.processor';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    RedisQueueModule,

    BullModule.registerQueue(
  {
    name: 'sms',
  },
  {
    name: 'email',
  },
  {
    name: 'whatsapp',
  },
  {
    name: 'push',
  },
),
  ],

  controllers: [CommunicationsController],

  providers: [
    CommunicationsService,

    EmailService,
    SmsService,
    WhatsappService,
    WebPushService,

    SchedulerService,

    SmsQueueService,
    SmsProcessor,
  ],

  exports: [
    CommunicationsService,

    EmailService,
    SmsService,
    WhatsappService,
    WebPushService,
  ],
})
export class CommunicationsModule {}