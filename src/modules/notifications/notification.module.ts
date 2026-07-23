import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module'; // Ensure path matches your project structure
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { NotificationGateway } from './gateways/notification.gateway';

// Recommended: Import PrismaModule if it exists in your project.
// If PrismaModule is marked @Global(), you can omit this import entirely.
// import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [
     PrismaModule, // Un-comment if Prisma is bundled in its own module
  AuditLogModule,
    ],
  controllers: [NotificationController],
  providers: [
    /**
     * Business logic
     */
    NotificationService,

    /**
     * Database layer
     */
    NotificationRepository,

    /**
     * Socket.IO real-time gateway
     */
    NotificationGateway,
  ],
  exports: [
    /**
     * Allows other modules to trigger notifications
     * (e.g., PrayerRequestModule, CommunicationModule, EventModule)
     */
    NotificationService,

    /**
     * Allows other modules to emit real-time events directly
     */
    NotificationGateway,
  ],
})
export class NotificationsModule {}