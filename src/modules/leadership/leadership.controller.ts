import { Controller, Post, Body, Patch, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { LeadershipService } from './leadership.service';
import { CreateClassDto } from './dto/create-class.dto';
import { EnrollMemberDto } from './dto/enroll-member.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('leadership-tracks')
@UseGuards(JwtAuthGuard)
export class LeadershipController {
  constructor(private readonly leadershipService: LeadershipService) {}

  @Post()
  async establishCourseTrack(@Body() dto: CreateClassDto) {
    return this.leadershipService.createClass(dto);
  }

  @Post(':classId/enrollments')
  async registerStudent(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: EnrollMemberDto
  ) {
    return this.leadershipService.enrollMember(classId, dto);
  }

  @Patch(':classId/students/:memberId/progress')
  async modifyPerformanceMetrics(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProgressDto
  ) {
    return this.leadershipService.updateStudentTrack(classId, memberId, dto);
  }
}