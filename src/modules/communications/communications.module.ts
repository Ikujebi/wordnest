import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { WebPushService } from './channels/push.service';
import { SchedulerService } from './channels/scheduler.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    EmailService,
    SmsService,
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