import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Inject,       // 👈 Added
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

import { AuthTokenService } from './services/auth-token.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthLockService } from './services/auth-lock.service';
import { AuthEmailService } from './services/auth-email.service';
import { AuthUserService } from './services/auth-user.service';

import { NotificationService } from '../modules/notifications/notification.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { AuditAction } from '../modules/audit-log/enums/audit-action.enum';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginResponse } from './interfaces/login-response.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { TokenPair } from './interfaces/token-pair.interface';
import { Role, NotificationType, ApprovalStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly tokenService: AuthTokenService,
    private readonly passwordService: AuthPasswordService,
    private readonly lockService: AuthLockService,
    private readonly emailService: AuthEmailService,
    private readonly userService: AuthUserService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Validate a user's credentials for Passport local strategy.
   */
  async validateUser(email: string, pass: string): Promise<any> {
    const normalizedEmail = this.userService.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { member: { select: { id: true } } },
    });

    if (!user || user.deletedAt || !user.isActive) {
      return null;
    }

    if (user.approvalStatus !== ApprovalStatus.APPROVED) {
      return null;
    }

    if (this.lockService.isAccountLocked(user.lockedUntil)) {
      return null;
    }

    const validPassword = await this.passwordService.verify(user.passwordHash, pass);

    if (!validPassword) {
      await this.lockService.incrementFailedLoginAttempts(user.id);

      await this.auditLogService.createLog(
        { id: user.id },
        {
          action: AuditAction.LOGIN_FAILED,
          entity: 'User',
          entityId: user.id,
          description: `Failed password validation attempt for user ${user.email}.`,
        },
      );
      return null;
    }

    await this.lockService.resetFailedLoginAttempts(user.id);
    return this.userService.mapAuthenticatedUser(user);
  }

  /**
   * Authenticate a user via email and password credentials.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = this.userService.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { member: { select: { id: true } } },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account has been disabled.');
    }

    if (this.lockService.isAccountLocked(user.lockedUntil)) {
      throw new ForbiddenException('Your account is temporarily locked. Please try again later.');
    }

    const validPassword = await this.passwordService.verify(user.passwordHash, dto.password);

    if (!validPassword) {
      await this.lockService.incrementFailedLoginAttempts(user.id);

      await this.auditLogService.createLog(
        { id: user.id },
        {
          action: AuditAction.LOGIN_FAILED,
          entity: 'User',
          entityId: user.id,
          description: `Invalid password attempt for email: ${user.email}.`,
        },
      );
      throw new UnauthorizedException('Invalid email or password.');
    }

    const requireVerification = this.configService.get<string>('REQUIRE_EMAIL_VERIFICATION', 'true') === 'true';
    if (requireVerification && !user.emailVerified) {
      throw new ForbiddenException('Please verify your email before logging in.');
    }

    // Check approval status
    if (user.approvalStatus === ApprovalStatus.PENDING) {
      throw new ForbiddenException('Your account is awaiting admin approval.');
    }

    if (user.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ForbiddenException('Your account application was not approved.');
    }

    await this.lockService.resetFailedLoginAttempts(user.id);

    const authenticatedUser = await this.userService.mapAuthenticatedUser(user);
    const tokens = await this.tokenService.generateTokens(authenticatedUser);

    // Update login metadata and track fresh tokens
    await this.prisma.$transaction(async (tx) => {
      await this.tokenService.updateRefreshTokenHash(user.id, tokens.refreshToken, tx);
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    });

    this.logger.log(`User ${user.email} logged in successfully.`);
    return { user: authenticatedUser, tokens };
  }

  /**
   * Register a new user, build relational records, and dispatch verification alerts.
   * Does NOT return JWT tokens since new accounts require admin approval.
   */
  async register(dto: RegisterDto): Promise<{ message: string; user: AuthenticatedUser }> {
    const email = this.userService.normalizeEmail(dto.email);

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Resolve role from a valid, matching invitation — never trust a
    // client-supplied role directly. Absence of a token, or any mismatch,
    // falls back to the safe default: MEMBER.
    let resolvedRole: Role = Role.MEMBER;
    let matchedInvitation: { id: string; email: string; role: Role } | null = null;

    if (dto.inviteToken) {
      const invitation = await this.prisma.invitation.findUnique({
        where: { token: dto.inviteToken },
      });

      if (!invitation || invitation.status !== 'PENDING') {
        throw new UnauthorizedException('Invitation token is invalid or has already been used.');
      }

      if (new Date() > invitation.expiresAt) {
        await this.prisma.invitation.update({
          where: { token: dto.inviteToken },
          data: { status: 'EXPIRED' },
        });
        throw new UnauthorizedException('This invitation has expired.');
      }

      // Prevent using someone else's invite token with a different email.
      if (this.userService.normalizeEmail(invitation.email) !== email) {
        throw new UnauthorizedException('This invitation was issued to a different email address.');
      }

      resolvedRole = invitation.role as Role;
      matchedInvitation = { id: invitation.id, email: invitation.email, role: resolvedRole };
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          phoneNumber: dto.phoneNumber?.trim() ?? null,
          profilePictureUrl: dto.profilePictureUrl ?? null,
          profilePicturePublicId: dto.profilePicturePublicId ?? null,
          passwordHash,
          role: resolvedRole,
          isActive: true,
          emailVerified: false,
          // Still PENDING even for invited roles — the invite establishes
          // WHO was invited and WHAT role, not that approval can be skipped.
          approvalStatus: ApprovalStatus.PENDING,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        include: { member: { select: { id: true } } },
      });

      if (matchedInvitation) {
        await tx.invitation.update({
          where: { id: matchedInvitation.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        });
      }

      return created;
    });

    await this.auditLogService.createLog(
      { id: user.id },
      {
        action: AuditAction.CREATE_USER,
        entity: 'User',
        entityId: user.id,
        description: matchedInvitation
          ? `New user account created for ${user.email} via invitation (role: ${resolvedRole}).`
          : `New user account created for ${user.email}.`,
      },
    );

    await this.notificationService.notifySuperAdmins({
      title: 'New Member Registered',
      message: `${user.fullName} (${user.email}) has created an account and is pending approval.`,
      type: NotificationType.SYSTEM,
    });

    const authenticatedUser = await this.userService.mapAuthenticatedUser(user);

    try {
      await this.emailService.sendVerificationEmail(authenticatedUser);
    } catch (error) {
      this.logger.error(
        `Registration succeeded for ${user.email}, but the verification email failed to send.`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    this.logger.log(`New user registered and pending approval: ${user.email} (role: ${resolvedRole})`);

    return {
      message: 'Registration successful. Your account is pending admin approval.',
      user: authenticatedUser,
    };
  }

  /**
   * Cycle active application JWT security values against persistent hash records.
   */
  async refresh({ userId, refreshToken }: { userId: string; refreshToken: string }): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { id: true } } },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account has been disabled.');
    }

    // Prevent refreshing tokens for non-approved users
    if (user.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Your account is not approved to perform this action.');
    }

    const validRefreshToken = await this.tokenService.verifyRefreshToken(user.refreshTokenHash, refreshToken);
    if (!validRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const authenticatedUser = await this.userService.mapAuthenticatedUser(user);
    const tokens = await this.tokenService.generateTokens(authenticatedUser);

    await this.tokenService.updateRefreshTokenHash(user.id, tokens.refreshToken);

    this.logger.log(`Tokens refreshed for user ${user.email}.`);
    return tokens;
  }

  /**
   * Clear validation fingerprints and log the current session out.
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    this.logger.log(`User ${userId} logged out successfully.`);
    return { message: 'Logged out successfully.' };
  }

  /**
   * Fetch the profile context payload of the current subject context.
   */
  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { id: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account has been disabled.');
    }

    if (user.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Your account is awaiting admin approval.');
    }

    return this.userService.mapAuthenticatedUser(user);
  }

  /**
   * Request a verification signature string to reset a lost profile identity credential.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = this.userService.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    const standardResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    if (!user || !user.isActive || user.deletedAt) {
      return standardResponse;
    }

    await this.emailService.sendPasswordResetEmail(user);
    return standardResponse;
  }

  /**
   * Consume authentication check payloads to update authorization tokens securely.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const matchedToken = await this.emailService.validatePasswordResetToken(dto.token);
    if (!matchedToken) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    const user = matchedToken.user;
    if (!user.isActive) {
      throw new ForbiddenException('Account has been disabled.');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          refreshTokenHash: null,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: matchedToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.auditLogService.createLog(
      { id: user.id },
      {
        action: AuditAction.PASSWORD_RESET,
        entity: 'User',
        entityId: user.id,
        description: `Password was successfully reset for user ${user.email}.`,
      },
    );

    const memberId = (user as any).member?.id;
    if (memberId) {
      await this.notificationService.notifyMember(memberId, {
        title: 'Security Alert: Password Reset',
        message: 'Your account password has been reset successfully.',
        type: NotificationType.SYSTEM,
      });
    }

    this.logger.log(`Password reset completed for ${user.email}`);
    return { message: 'Password has been reset successfully.' };
  }

  /**
   * Confirm ownership claims over a designated email contact channel string.
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const matchedToken = await this.emailService.validateEmailVerificationToken(token);
    if (!matchedToken) {
      throw new UnauthorizedException('Invalid or expired verification link.');
    }

    const user = matchedToken.user;
    if (!user.isActive) {
      throw new ForbiddenException('Account has been disabled.');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }

    if (user.emailVerified) {
      return { message: 'Email has already been verified.' };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: matchedToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      }),
    ]);

    await this.auditLogService.createLog(
      { id: user.id },
      {
        action: AuditAction.EMAIL_VERIFIED,
        entity: 'User',
        entityId: user.id,
        description: `Email ${user.email} was successfully verified.`,
      },
    );

    const memberId = (user as any).member?.id;
    if (memberId) {
      await this.notificationService.notifyMember(memberId, {
        title: 'Account Verified',
        message: 'Your email address has been successfully verified.',
        type: NotificationType.SYSTEM,
      });
    }

    this.logger.log(`Email verified for ${user.email}`);
    return { message: 'Email verified successfully.' };
  }

  /**
   * Resend an unverified verification link message request.
   */
  async resendVerificationEmail(userId: string): Promise<{ message: string }> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { member: { select: { id: true } } },
  });

  if (!user) throw new UnauthorizedException('User not found.');
  if (user.deletedAt) throw new UnauthorizedException('Account no longer exists.');
  if (!user.isActive) throw new ForbiddenException('Account has been disabled.');
  if (user.emailVerified) return { message: 'Email has already been verified.' };

  const authenticatedUser = await this.userService.mapAuthenticatedUser(user);

  try {
    // Delegates directly to AuthEmailService to guarantee token generation consistency
    await this.emailService.sendVerificationEmail(authenticatedUser);
  } catch (error) {
    this.logger.error(
      `Failed to resend verification email to ${user.email}.`,
      error instanceof Error ? error.stack : String(error),
    );
    throw new Error('Unable to send verification email right now. Please try again shortly.');
  }

  return { message: 'A new verification email has been sent.' };
}
}