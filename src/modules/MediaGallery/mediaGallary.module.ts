import { Module } from '@nestjs/common';
import { MediaGalleryService } from './mediaGallery.service';
import { MediaGalleryController } from './mediaGallary.controller';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module'; // Adjust path
import { PrismaModule } from '../../prisma/prisma.module'; // Adjust path
import { AuditLogModule } from '../audit-log/audit-log.module'; // Adjust path
import { NotificationsModule } from '../notifications/notification.module'; // Adjust path

@Module({
  imports: [
    CloudinaryModule,
    PrismaModule,
    AuditLogModule,
    NotificationsModule,
  ],
  controllers: [MediaGalleryController],
  providers: [MediaGalleryService],
  exports: [MediaGalleryService],
})
export class MediaGalleryModule {}