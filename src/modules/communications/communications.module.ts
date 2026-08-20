import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '../../prisma/prisma.module';
import { RedisQueueModule } from '../../config/redis.config';

import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

// 🛠️ UPDATE THESE FOUR IMPORTS TO POINT TO THE 'services' SUBFOLDER:
import { BroadcastService } from './services/broadcast.service'; 
import { RecipientService } from './services/recipient.service'; 
import { StatisticsService } from './services/statistics.service'; 
import { SchedulerService } from './services/scheduler.service'; 
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { WhatsappService } from './channels/whatsapp.service';
import { WebPushService } from './channels/push.service';
import { NotificationsModule } from '../notifications/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SmsQueueService } from './channels/sms/sms.queue';
import { SmsProcessor } from './channels/sms/sms.processor';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    RedisQueueModule,
    NotificationsModule,
    CloudinaryModule,
    AuditLogModule,
    BullModule.registerQueue(
      { name: 'sms' },
      { name: 'email' },
      { name: 'whatsapp' },
      { name: 'push' },
    ),
  ],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    
    // These now reference the exact classes the service expects
    BroadcastService,
    RecipientService,
    StatisticsService,
    SchedulerService,

    EmailService,
    SmsService,
    WhatsappService,
    WebPushService,
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