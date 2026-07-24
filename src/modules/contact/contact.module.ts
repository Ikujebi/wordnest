import { Module } from '@nestjs/common';

import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { ContactRepository } from './contact.repository';

// Updated import to match the plural export 'NotificationsModule'
import { NotificationsModule } from '../notifications/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module'; // Adjust path as needed

@Module({
  imports: [
    NotificationsModule,
    AuditLogModule,
  ],

  controllers: [
    ContactController,
  ],

  providers: [
    ContactService,
    ContactRepository,
  ],

  exports: [
    ContactService,
  ],
})
export class ContactModule {}