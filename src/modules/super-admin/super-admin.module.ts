// src/super-admin/super-admin.module.ts
import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module'; // Adjust path if needed

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditLogModule,
    CloudinaryModule,
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}