import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WorkerService } from './worker.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { WorkerQueryDto } from './dto/worker-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('workers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post()
  create(@Req() req: any, @Body() createWorkerDto: CreateWorkerDto) {
    return this.workerService.create(createWorkerDto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: WorkerQueryDto) {
    return this.workerService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workerService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateWorkerDto: UpdateWorkerDto,
  ) {
    return this.workerService.update(id, updateWorkerDto, req.user?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.workerService.remove(id, req.user?.id);
  }

  @Post(':id/attendance')
  recordAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() attendanceDto: RecordAttendanceDto,
  ) {
    return this.workerService.recordAttendance(id, attendanceDto, req.user?.id);
  }
}