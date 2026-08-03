import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';

@Injectable()
export class MemberSelfService {
  private readonly logger = new Logger(MemberSelfService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getMemberByUserId(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true, createdAt: true } },
        worker: { select: { position: true, department: { select: { name: true } } } },
      },
    });
    if (!member || member.deletedAt) throw new NotFoundException('Member profile not found for this account.');
    return member;
  }

  async getProfile(userId: string) {
    return this.getMemberByUserId(userId);
  }

  async updateProfile(userId: string, dto: UpdateMemberProfileDto) {
    const member = await this.getMemberByUserId(userId);
    try {
      return await this.prisma.member.update({
        where: { id: member.id },
        data: dto,
        include: { user: { select: { id: true, email: true, fullName: true, role: true } } },
      });
    } catch (error) {
      this.logger.error('Failed to update member profile', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not update profile.');
    }
  }

  async updateNotificationPrefs(userId: string, dto: UpdateNotificationPrefsDto) {
    const member = await this.getMemberByUserId(userId);
    return this.prisma.member.update({ where: { id: member.id }, data: dto });
  }

  /** Announcements/devotionals actually sent to this member, newest first. */
  async getMyCommunications(userId: string, type?: 'ANNOUNCEMENT' | 'DEVOTIONAL' | string) {
    const member = await this.getMemberByUserId(userId);

    return this.prisma.communicationRecipient.findMany({
      where: {
        memberId: member.id,
        communication: {
          status: 'SENT',
          deletedAt: null,
          ...(type ? { type: type as any } : {}),
        },
      },
      include: { communication: true },
      orderBy: { communication: { sentAt: 'desc' } },
      take: 50,
    });
  }

  /** Events this member is registered/attended for, plus RSVP status per event. */
  async getMyEventActivity(userId: string) {
    const member = await this.getMemberByUserId(userId);
    return this.prisma.attendance.findMany({
      where: { memberId: member.id },
      include: { event: true },
      orderBy: { event: { startDate: 'desc' } },
    });
  }
}