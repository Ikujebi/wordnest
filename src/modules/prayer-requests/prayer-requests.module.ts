import { Module } from '@nestjs/common';

import { PrayerRequestsController } from './prayer-requests.controller';
import { PrayerRequestsService } from './prayer-requests.service';
import { PrayerCommunicationService } from './prayer-communication.service';
import { PrayerAccessGuard } from './guards/prayer-access.guard';

import { CommunicationsModule } from '../communications/communications.module';
import { NotificationsModule } from '../notifications/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  imports: [
    CommunicationsModule,
    NotificationsModule,
    AuditLogModule,
  ],
  controllers: [
    PrayerRequestsController,
  ],
  providers: [
    PrayerRequestsService,
    PrayerCommunicationService,
    PrayerAccessGuard,
    PrismaService,
  ],
  exports: [
    PrayerRequestsService,
    PrayerCommunicationService,
    PrayerAccessGuard,
  ],
})
export class PrayerRequestsModule {}