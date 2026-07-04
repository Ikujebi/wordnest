import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './services/notifications.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, AuditLogInterceptor],
  exports: [NotificationsService, AuditLogInterceptor],
})
export class CommonModule {}