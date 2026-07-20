import { Controller, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { MemberService } from './member.service';
import { PrismaService } from '../../../prisma/prisma.service'; // Make sure to import Prisma

@Controller('api/member')
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly prisma: PrismaService // Inject Prisma to resolve the User -> Member relation
  ) {}

  @Get('dashboard')
  async getPersonalDashboard(@Req() req: any) {
    // 1. req.user.id comes from your JWT payload (User Table)
    const userId = req.user.id; 

    // 2. Look up the corresponding Member record linked to this User
    const memberRecord = await this.prisma.member.findUnique({
      where: { userId: userId },
      select: { id: true },
    });

    if (!memberRecord) {
      throw new UnauthorizedException('Member profile not found for this user account.');
    }

    // 3. Pass the actual Member ID to your dashboard service
    return this.memberService.getPersonalDashboard(memberRecord.id);
  }
}