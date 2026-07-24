import { Module } from '@nestjs/common';
import { SermonService } from './sermon.service';
import { SermonController } from './sermon.controller';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module'; // Adjust path
import { AuditLogModule } from '../audit-log/audit-log.module'; // Adjust path
import { NotificationsModule } from '../notifications/notification.module'; // Adjust path

@Module({
  imports: [CloudinaryModule, AuditLogModule, NotificationsModule],
  controllers: [SermonController],
  providers: [SermonService],
  exports: [SermonService],
})
export class SermonModule {}