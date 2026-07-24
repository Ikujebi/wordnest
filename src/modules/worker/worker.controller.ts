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
} from '@nestjs/common';
import { WorkerService } from './worker.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { WorkerQueryDto } from './dto/worker-query.dto';

@Controller('workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post()
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.workerService.create(createWorkerDto);
  }

  @Get()
  findAll(@Query() query: WorkerQueryDto) {
    return this.workerService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWorkerDto: UpdateWorkerDto) {
    return this.workerService.update(id, updateWorkerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.workerService.remove(id);
  }

  @Post(':id/attendance')
  recordAttendance(
    @Param('id') id: string,
    @Body() attendanceDto: RecordAttendanceDto,
  ) {
    return this.workerService.recordAttendance(id, attendanceDto);
  }
}