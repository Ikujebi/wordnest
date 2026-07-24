import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notification.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    NotificationsModule,
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}