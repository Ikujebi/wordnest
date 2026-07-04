import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MinistriesService } from './ministries.service';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { LogWorkerAttendanceDto } from './dto/log-worker-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('ministries')
@UseGuards(JwtAuthGuard)
export class MinistriesController {
  constructor(private readonly ministriesService: MinistriesService) {}

  @Post()
  async establishMinistry(@Body() dto: CreateMinistryDto) {
    return this.ministriesService.createMinistry(dto);
  }

  @Post('attendance/logs')
  async logRosterDuty(@Body() dto: LogWorkerAttendanceDto) {
    return this.ministriesService.trackWorkerDuty(dto);
  }
}