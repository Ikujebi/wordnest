import { Module } from '@nestjs/common';
import { MemberSelfController } from './member-self.controller';
import { MemberSelfService } from './member-self.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkerPipelineModule } from '../worker-pipeline/worker-pipeline.module'; 
@Module({
  imports: [PrismaModule, WorkerPipelineModule,],
  controllers: [MemberSelfController],
  providers: [MemberSelfService],
  exports: [MemberSelfService],
})
export class MemberSelfModule {}