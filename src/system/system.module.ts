import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { NotificationsModule } from '../modules/notifications/notification.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, AuditLogModule, NotificationsModule, CloudinaryModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}