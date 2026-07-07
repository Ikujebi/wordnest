import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { PushService } from './channels/push.service';
import { SchedulerService } from './channels/scheduler.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    EmailService,
    SmsService,
    PushService,
    SchedulerService,
  ],
  exports: [
    CommunicationsService,
    EmailService,
    SmsService,
    PushService,
  ],
})
export class CommunicationsModule {}