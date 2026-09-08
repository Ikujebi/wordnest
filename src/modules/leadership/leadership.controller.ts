import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { LeadershipService } from './leadership.service';
import { CreateClassDto } from './dto/create-class.dto';
import { EnrollMemberDto } from './dto/enroll-member.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { RecordLeadershipAttendanceDto } from './dto/record-leadership-attendance.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { GradeAssignmentDto } from './dto/grade-assignment.dto';
import { FinalizeCohortDto } from './dto/finalize-cohort.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('leadership')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class LeadershipController {
  constructor(private readonly leadershipService: LeadershipService) {}

  @Post('classes')
  createClass(@Body() dto: CreateClassDto) {
    return this.leadershipService.createClass(dto);
  }

  @Post('classes/:id/enroll')
  enrollMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EnrollMemberDto) {
    return this.leadershipService.enrollMember(id, dto);
  }

  @Get('classes/:id/roster')
  getClassRoster(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadershipService.getClassRoster(id);
  }

  @Patch('classes/:id/students/:memberId')
  updateStudentTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.leadershipService.updateStudentTrack(id, memberId, dto);
  }

  @Delete('classes/:id/students/:memberId')
  withdrawStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.leadershipService.withdrawStudent(id, memberId);
  }

  @Post('sessions/:sessionId/attendance')
  recordAttendance(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RecordLeadershipAttendanceDto,
  ) {
    return this.leadershipService.recordAttendance(sessionId, dto);
  }

  @Get('sessions/:sessionId/attendance')
  getSessionAttendance(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.leadershipService.getSessionAttendance(sessionId);
  }

  @Post('classes/:id/assignments')
  createAssignment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAssignmentDto) {
    return this.leadershipService.createAssignment(id, dto);
  }

  @Get('classes/:id/assignments')
  listAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadershipService.listAssignments(id);
  }

  @Post('assignments/:assignmentId/grade')
  gradeAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Req() req: any,
    @Body() dto: GradeAssignmentDto,
  ) {
    return this.leadershipService.gradeAssignment(assignmentId, dto, req.user.id);
  }

  @Post('classes/:id/finalize')
  finalizeCohort(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: FinalizeCohortDto,
  ) {
    return this.leadershipService.finalizeCohort(id, dto, req.user.id);
  }
}