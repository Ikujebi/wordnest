import { Controller, Get, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { MemberSelfService } from './member-self.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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
}