// src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notification.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../../auth/auth.module';
@Module({
  imports: [PrismaModule, AuditLogModule, NotificationsModule,AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}