import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MinistriesService } from './ministries.service';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { AssignMinistryLeaderDto } from './dto/assign-ministry-leader.dto';
import { AddMinistryMemberDto } from './dto/add-ministry-member.dto';
import { UpdateMinistryMemberDto } from './dto/update-ministry-member.dto';
import { LogWorkerAttendanceDto } from './dto/log-worker-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('ministries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MinistriesController {
  constructor(private readonly ministriesService: MinistriesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Req() req: any, @Body() dto: CreateMinistryDto) {
    return this.ministriesService.create(dto, req.user.id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll() {
    return this.ministriesService.findAll();
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateMinistryDto,
  ) {
    return this.ministriesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.ministriesService.remove(id, req.user.id);
  }

  @Patch(':id/leader')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  assignLeader(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: AssignMinistryLeaderDto,
  ) {
    return this.ministriesService.assignLeader(id, dto, req.user.id);
  }

  @Delete(':id/leader')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  removeLeader(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.ministriesService.removeLeader(id, req.user.id);
  }

  @Get(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.ministriesService.getMembers(id);
  }

  @Post(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: AddMinistryMemberDto,
  ) {
    return this.ministriesService.addMember(id, dto, req.user.id);
  }

  @Patch(':ministryId/members/:memberId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateMemberAssignment(
    @Param('ministryId', ParseUUIDPipe) ministryId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: any,
    @Body() dto: UpdateMinistryMemberDto,
  ) {
    return this.ministriesService.updateMemberAssignment(ministryId, memberId, dto, req.user.id);
  }

  @Post('attendance/logs')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  logRosterDuty(@Body() dto: LogWorkerAttendanceDto) {
    return this.ministriesService.trackWorkerDuty(dto);
  }

  // IMPORTANT: keep this LAST — ':id' is a catch-all and would otherwise
  // shadow 'attendance/logs' or any future static segment.
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ministriesService.findOne(id);
  }
}