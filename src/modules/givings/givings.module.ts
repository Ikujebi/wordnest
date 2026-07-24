import { Module } from '@nestjs/common';
import { GivingsService } from './givings.service';
import { GivingsController } from './givings.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { NotificationsModule } from '../notifications/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditLogModule,
  ],
  controllers: [GivingsController],
  providers: [GivingsService],
  exports: [GivingsService],
})
export class GivingsModule {}