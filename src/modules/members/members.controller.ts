import { Controller, Get, Post, Body, Patch, UseGuards, Req } from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Adjust path based on your Auth setup

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('me')
  async createMyProfile(@Req() req: any, @Body() createMemberDto: CreateMemberDto) {
    // req.user.id is populated dynamically from your passport-jwt strategy payload
    return this.membersService.createMemberProfile(req.user.id, createMemberDto);
  }

  @Get('me')
  async getMyProfile(@Req() req: any) {
    return this.membersService.findByUserId(req.user.id);
  }

  @Patch('me')
  async updateMyProfile(@Req() req: any, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.updateMemberProfile(req.user.id, updateMemberDto);
  }
}