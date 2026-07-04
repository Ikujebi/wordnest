import { Module } from '@nestjs/common';
import { WorkerPipelineService } from './worker-pipeline.service';
import { WorkerPipelineController } from './worker-pipeline.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkerPipelineController],
  providers: [WorkerPipelineService],
  exports: [WorkerPipelineService],
})
export class WorkerPipelineModule {}