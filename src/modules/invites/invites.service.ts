// invites.service.ts
import { Injectable, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../communications/channels/email.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { InviteStatus, InviteRole } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async sendInvite(dto: SendInviteDto) {
    // 1. Verify if an active authentication account already exists for this email
    const existingUser = await this.prisma.user.findFirst({
      where: { 
        email: dto.email, 
        deletedAt: null 
      },
    });
    
    if (existingUser) {
      throw new ConflictException('A registered user account already exists for this email address.');
    }

    // 2. Generate secure unique token and a rolling 48-hour expiration window
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // 3. Upsert invitation (overwrites old pending/expired records for this email cleanly)
    await this.prisma.invitation.upsert({
      where: { email: dto.email },
      update: {
        token,
        role: dto.role as InviteRole, // Casts directly to schema InviteRole enum
        status: InviteStatus.PENDING,
        expiresAt,
      },
      create: {
        email: dto.email,
        role: dto.role as InviteRole,
        token,
        expiresAt,
      },
    });

    // 4. Construct invitation dynamic payload pointing directly to your Next.js application frontend
    const inviteLink = `http://portal.wordtabernacle.org.ng/signup?token=${token}`;
    
    const subject = dto.role === 'ADMIN' 
      ? 'Action Required: You have been invited as an Administrator' 
      : 'Welcome! You have been invited to join';

    const content = `
      <h3>You are invited!</h3>
      <p>You have been assigned the role of <strong>${dto.role}</strong>.</p>
      <p>Click the link below to accept your invitation and complete your profile registration. This link expires in 48 hours.</p>
      <a href="${inviteLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
    `;

    // 5. Direct dispatch through your custom Resend Email Service layout
    await this.emailService.sendEmail(
      dto.email,
      subject,
      content
    );

    this.logger.log(`Invitation token dispatched successfully to ${dto.email} as ${dto.role}`);
    return { message: 'Invitation sent safely.', expiresAt };
  }

  /**
   * Validates a token when the client lands on the onboarding/registration interface.
   */
  async validateToken(token: string) {
    const invite = await this.prisma.invitation.findUnique({ 
      where: { token } 
    });
    
    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException('Invitation token is invalid or has already been consumed.');
    }

    if (new Date() > invite.expiresAt) {
      // Transition status to expired reactively upon access attempt
      await this.prisma.invitation.update({
        where: { token },
        data: { status: InviteStatus.EXPIRED },
      });
      throw new BadRequestException('This invitation token has expired.');
    }

    // Check if there is an offline member matching this email to ease registration auto-linking
    const matchingMember = await this.prisma.member.findFirst({
      where: { email: invite.email, deletedAt: null },
      select: { id: true, firstName: true, lastName: true }
    });

    return { 
      email: invite.email, 
      role: invite.role,
      existingMemberId: matchingMember?.id || null 
    };
  }
}