import { Module } from '@nestjs/common';
import { WorkerPipelineService } from './worker-pipeline.service';
import { WorkerPipelineController } from './worker-pipeline.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notification.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditLogModule,
  ],
  controllers: [WorkerPipelineController],
  providers: [WorkerPipelineService],
  exports: [WorkerPipelineService],
})
export class WorkerPipelineModule {}