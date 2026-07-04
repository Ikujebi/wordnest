import { Controller, Post, Body, Patch, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { WorkerPipelineService } from './worker-pipeline.service';
import { ApplyTrainingDto } from './dto/apply-training.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('worker-onboarding')
@UseGuards(JwtAuthGuard)
export class WorkerPipelineController {
  constructor(private readonly pipelineService: WorkerPipelineService) {}

  @Post('applications')
  async fileApplication(@Body() dto: ApplyTrainingDto) {
    return this.pipelineService.initializeOnboarding(dto);
  }

  @Patch('applications/:id/stage')
  async progressStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePipelineStageDto
  ) {
    return this.pipelineService.advancePipelineStage(id, dto);
  }
}