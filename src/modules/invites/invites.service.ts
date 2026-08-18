import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { InviteStatus, InviteRole, Role } from '@prisma/client';
import * as crypto from 'crypto';
import { AuditAction } from '../audit-log/enums/audit-action.enum'

// Auth Services
import { AuthPasswordService } from '../../auth/services/auth-password.service';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { AuthUserService } from '../../auth/services/auth-user.service';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly passwordService: AuthPasswordService,
    private readonly tokenService: AuthTokenService,
    private readonly authUserService: AuthUserService,
  ) {}

  async sendInvite(dto: SendInviteDto) {
    // 1. Verify if an active authentication account already exists for this email
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
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
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://portal.wordtabernacle.org.ng';

    const inviteLink = `${frontendUrl}/signup?token=${token}`;
    const subject =
      dto.role === 'ADMIN'
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
      content,
    );

    this.logger.log(`Invitation token dispatched successfully to ${dto.email} as ${dto.role}`);
    return { message: 'Invitation sent safely.', expiresAt };
  }

  /**
   * Validates a token when the client lands on the onboarding/registration interface.
   */
  async validateToken(token: string) {
    const invite = await this.prisma.invitation.findUnique({
      where: { token },
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
      select: { id: true, firstName: true, lastName: true },
    });

    return {
      email: invite.email,
      role: invite.role,
      existingMemberId: matchingMember?.id || null,
    };
  }

  /**
   * Accepts an invitation, provisions the new user account, updates the invitation state, and returns auth tokens.
   */
    async acceptInvite(dto: { token: string; fullName: string; password: string; phoneNumber?: string }) {
    const invite = await this.prisma.invitation.findUnique({ where: { token: dto.token } });

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException('Invitation token is invalid or has already been consumed.');
    }
    if (new Date() > invite.expiresAt) {
      await this.prisma.invitation.update({ where: { token: dto.token }, data: { status: InviteStatus.EXPIRED } });
      throw new BadRequestException('This invitation token has expired.');
    }

    const existingUser = await this.prisma.user.findFirst({ where: { email: invite.email, deletedAt: null } });
    if (existingUser) {
      throw new ConflictException('A registered user account already exists for this email address.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    // Invited users still require approval — the invite establishes WHO was
    // invited and WHAT role, not that a human check can be skipped. Email is
    // considered verified (the invite proves ownership), but the account is
    // not usable until a super admin/admin approves it.
    const user = await this.prisma.user.create({
      data: {
        email: invite.email,
        fullName: dto.fullName.trim(),
        phoneNumber: dto.phoneNumber?.trim() ?? null,
        passwordHash,
        role: invite.role as unknown as Role,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        approvalStatus: 'PENDING',
      },
    });

    await this.prisma.invitation.update({
      where: { token: dto.token },
      data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
    });

    // No tokens issued — matches AuthService.register's behavior for any
    // PENDING account. They log in normally once approved.
    return {
      message: 'Registration successful. Your account is pending admin approval.',
    };
  }
  /**
 * Lists pending (not yet accepted, not expired) invitations, optionally
 * filtered by role — so the admins page can show only ADMIN/SUPER_ADMIN
 * invites and the members page can show only MEMBER invites.
 */
async listPending(roles?: ('MEMBER' | 'ADMIN' | 'SUPER_ADMIN')[]) {
  return this.prisma.invitation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { gt: new Date() },
      ...(roles && roles.length ? { role: { in: roles } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
}

/**
 * Cancels a pending invite before it's accepted — needed so admins can
 * clean up mistaken/stale invitations.
 */
async cancelInvite(invitationId: string, performingAdminId: string) {
  const invite = await this.prisma.invitation.findUnique({ where: { id: invitationId } });

  if (!invite || invite.status !== 'PENDING') {
    throw new NotFoundException('Pending invitation not found.');
  }

  const cancelled = await this.prisma.invitation.update({
    where: { id: invitationId },
    data: { status: InviteStatus.CANCELLED },
  });

  await this.auditLogService.createLog(
    { id: performingAdminId },
    {
      action: AuditAction.CANCEL_INVITATION,
      entity: 'Invitation',
      entityId: invitationId,
      description: `Cancelled pending invitation for ${invite.email}`,
      oldValues: { status: invite.status },
      newValues: { status: cancelled.status },
    },
  );

  return { message: 'Invitation cancelled.' };
}

/**
 * Resends a pending invite — new token, new expiry, same email/role.
 */
async resendInvite(invitationId: string, performingAdminId: string) {
  const invite = await this.prisma.invitation.findUnique({ where: { id: invitationId } });

  if (!invite || invite.status !== 'PENDING') {
    throw new NotFoundException('Pending invitation not found.');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const updated = await this.prisma.invitation.update({
    where: { id: invitationId },
    data: {
      token: hashedToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days, matching your invite expiry elsewhere
    },
  });

  const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${rawToken}`;

  await this.emailService.sendEmail(
  invite.email,
  'Reminder: You have been invited to WTBC Portal',
  `
    <p>This is a reminder that you've been invited to join the WTBC Portal as ${invite.role.replace('_', ' ')}.</p>
    <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    <p>This link expires in 7 days.</p>
  `,
);

  await this.auditLogService.createLog(
    { id: performingAdminId },
    {
      action: AuditAction.CREATE_INVITATION,
      entity: 'Invitation',
      entityId: invitationId,
      description: `Resent invitation to ${invite.email}`,
    },
  );

  return { message: `Invitation resent to ${invite.email}.` };
}
}