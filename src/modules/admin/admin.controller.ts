import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Get('metrics/summary')
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('members')
  getAllMembers(@Query() query: MemberQueryDto) {
    return this.adminService.listAllMembers(query);
  }

  @Get('members/:id')
  getMemberDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.targetIndividualMember(id);
  }

  @Post('members')
  createMember(@Req() req: any, @Body() dto: CreateMemberDto) {
    return this.adminService.createMember(dto, req.user.id);
  }
  @Get('metrics/growth')
  getMemberGrowth() {
    return this.adminService.getMemberGrowth();
  }
  @Patch('members/:id')
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateMemberStatusDto,
  ) {
    return this.adminService.updateIndividualMemberStatus(req.user.id, id, dto);
  }

  @Delete('members/:id')
  deleteMember(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.adminService.deleteMember(id, req.user.id);
  }
  @Get('approvals')
  listPendingApprovals() {
    return this.adminService.listPendingMemberApprovals();
  }

  @Patch('approvals/:id/approve')
  approveMember(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.adminService.approveMemberAccount(req.user.id, id);
  }

  @Patch('approvals/:id/reject')
  rejectMember(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.adminService.rejectMemberAccount(req.user.id, id);
  }
  @Post('approvals/:id/resend-verification')
resendVerification(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
  return this.adminService.resendPendingMemberVerification(req.user.id, id);
}

@Delete('approvals/:id')
deletePendingMember(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
  return this.adminService.hardDeletePendingMember(req.user.id, id);
}
}