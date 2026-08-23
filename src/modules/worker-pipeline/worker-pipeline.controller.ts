import { Controller, Get, Post, Body, Patch, Param, Query, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { WorkerPipelineService } from './worker-pipeline.service';
import { ApplyTrainingDto } from './dto/apply-training.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';
import { PipelineQueryDto } from './dto/pipeline-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AssignMentorDto } from './dto/assign-mentor.dto';
import { AddPipelineNoteDto } from './dto/add-pipeline-note.dto';

@Controller('worker-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class WorkerPipelineController {
  constructor(private readonly pipelineService: WorkerPipelineService) {}

  @Get('applications')
  async listApplications(@Query() query: PipelineQueryDto) {
    return this.pipelineService.findAll(query);
  }

  @Get('applications/:id')
  async getApplication(@Param('id', ParseUUIDPipe) id: string) {
    return this.pipelineService.findOne(id);
  }

  @Post('applications')
  async fileApplication(@Req() req: any, @Body() dto: ApplyTrainingDto) {
    return this.pipelineService.initializeOnboarding(dto, req.user.id);
  }

  @Patch('applications/:id/stage')
  async progressStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    return this.pipelineService.advancePipelineStage(id, dto, req.user.id);
  }
    @Patch('applications/:id/mentor')
  async assignMentor(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: AssignMentorDto,
  ) {
    return this.pipelineService.assignMentor(id, dto, req.user.id);
  }

  @Post('applications/:id/notes')
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: AddPipelineNoteDto,
  ) {
    return this.pipelineService.addNote(id, dto, req.user.id);
  }
}