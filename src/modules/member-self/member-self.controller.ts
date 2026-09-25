import { Controller, Get, Patch, Body, Query, UseGuards, Req,Post } from '@nestjs/common';
import { MemberSelfService } from './member-self.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MemberApplyTrainingDto } from './dto/member-apply-training.dto';
@Controller('member')
@UseGuards(JwtAuthGuard)
export class MemberSelfController {
  constructor(private readonly memberSelfService: MemberSelfService) {}

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.memberSelfService.getProfile(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateMemberProfileDto) {
    return this.memberSelfService.updateProfile(req.user.id, dto);
  }

  @Patch('notification-preferences')
  updateNotificationPrefs(@Req() req: any, @Body() dto: UpdateNotificationPrefsDto) {
    return this.memberSelfService.updateNotificationPrefs(req.user.id, dto);
  }

  @Get('communications')
  getMyCommunications(@Req() req: any, @Query('type') type?: string) {
    return this.memberSelfService.getMyCommunications(req.user.id, type);
  }

  @Get('event-activity')
  getMyEventActivity(@Req() req: any) {
    return this.memberSelfService.getMyEventActivity(req.user.id);
  }
  @Get('worker-cohort')
getCohortStatus() {
  return this.memberSelfService.getOpenCohort();
}

@Post('worker-applications')
apply(@Req() req: any, @Body() dto: MemberApplyTrainingDto) {
  return this.memberSelfService.applyForWorkerTraining(req.user.id, dto);
}
@Get('departments')
listDepartments() {
  return this.memberSelfService.listDepartmentsForApplication();
}
@Get('worker-cohort')
async getWorkerCohort() {
  return this.memberSelfService.getWorkerCohort();
}
}