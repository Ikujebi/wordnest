import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { USER_SECURITY_CONFIG } from './users.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPaginationQueryDto } from './dto/user-pagination-query.dto';
import { USER_ERROR_MESSAGES } from './users.constants';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { AuditAction } from '../modules/audit-log/enums/audit-action.enum'
// Remove sensitive fields from API response
export type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
  ) { }

  /**
   * Get paginated users
   */
  async findAll(query: UserPaginationQueryDto): Promise<User[]> {
    const { page = 1, limit = 10, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(typeof isActive === 'boolean' && { isActive }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: { member: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find user by ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { member: true },
    });

    if (!user) {
      throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
    }

    return user;
  }

  /**
   * Find by email (auth use)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
      include: { member: true },
    });
  }

  /**
   * Create user
   */
  async create(dto: CreateUserDto): Promise<SanitizedUser> {
    const { password, ...data } = dto;

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...data,
          passwordHash,
        },
      });

      const { passwordHash: _, ...sanitized } = user;
      return sanitized;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      this.logger.error(error);
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  /**
   * Update user
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.fullName) data.fullName = dto.fullName.trim();
    if (dto.email) data.email = dto.email.trim().toLowerCase();
    if (dto.role) data.role = dto.role;
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        include: { member: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
        }
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An account with this email already exists.',
          );
        }
      }

      this.logger.error(error);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  /**
   * Upload profile picture
   */
  async updateProfilePicture(
    id: string,
    file: Express.Multer.File,
  ): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
    }

    try {
      if (user.profilePicturePublicId) {
        await this.cloudinaryService.deleteFile(
          user.profilePicturePublicId,
        );
      }

      const uploaded = await this.cloudinaryService.uploadFile(file, {
        folder: 'profile-pictures',
        transformations: [
          {
            width: 200,
            height: 200,
            crop: 'fill',
            gravity: 'face',
          },
        ],
      });

      return this.prisma.user.update({
        where: { id },
        data: {
          profilePictureUrl: uploaded.secure_url,
          profilePicturePublicId: uploaded.public_id,
        },
        include: { member: true },
      });
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Failed to update profile picture',
      );
    }
  }

  /**
   * Soft delete user
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
      }

      this.logger.error(error);
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
  /**
 * Members with a birthday (month+day, ignoring year) falling within the
 * next N days. Filtered in JS since comparing month/day across a year
 * boundary (e.g. Dec 28 -> Jan 5) isn't a clean single SQL WHERE clause.
 */
  async getUpcomingBirthdays(days = 30) {
    const members = await this.prisma.member.findMany({
      where: { deletedAt: null, dateOfBirth: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        email: true,
        phoneNumber: true,
      },
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const withNextOccurrence = members
      .map((m) => {
        const dob = m.dateOfBirth!;
        let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        if (next < startOfToday) {
          next = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
        }
        const daysUntil = Math.round((next.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
        return { ...m, nextBirthday: next, daysUntil };
      })
      .filter((m) => m.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return withNextOccurrence;
  }
  /**
   * Admin-triggered resend of the email verification link. Invalidates any
   * prior unused token for this user and issues a fresh one — mirrors the
   * self-service resend flow, just triggerable by an admin on someone else's
   * behalf (for cases where the original email was lost/never arrived).
   */
  async resendVerificationEmail(userId: string, performingAdminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found.');
    }

    if (user.emailVerified) {
      throw new BadRequestException('This account is already verified.');
    }

    // Invalidate any outstanding unused tokens for this user before issuing
    // a new one, so an old leaked/expired link can't still be used.
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt: new Date(Date.now() + USER_SECURITY_CONFIG.EMAIL_TOKEN_EXPIRY_MS),
      },
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    await this.emailService.sendEmail(
      user.email,
      'Verify your WTBC Portal account',
      `
    <p>Hello ${user.fullName || ''},</p>
    <p>An administrator has resent your account verification link. Click below to verify your email address:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `,
    );

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.EMAIL_VERIFIED, // or add a dedicated RESEND_VERIFICATION action to your enum
        entity: 'USER',
        entityId: userId,
        description: `Resent verification email to ${user.email}`,
      },
    );

    return { message: `Verification email resent to ${user.email}.` };
  }

  /**
   * Deletes an account that never completed email verification. This is a
   * HARD delete, not the soft-delete pattern used elsewhere — an unverified
   * account has no real associated data (no member profile activity, no
   * audit trail worth preserving beyond this log entry), so there's nothing
   * to retain. If a Member profile was somehow already linked, this refuses
   * and tells the admin to use the standard member-deactivation flow instead.
   */
  async deleteUnverifiedUser(userId: string, performingAdminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { id: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.emailVerified) {
      throw new BadRequestException(
        'This account is already verified. Use the standard suspend/delete flow instead.',
      );
    }

    if (user.member) {
      throw new BadRequestException(
        'This account has an associated member profile and cannot be hard-deleted. Use the standard member removal flow.',
      );
    }

    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await this.prisma.user.delete({ where: { id: userId } });

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.DELETE_USER,
        entity: 'USER',
        entityId: userId,
        description: `Permanently deleted unverified account for ${user.email}`,
        oldValues: { email: user.email, role: user.role },
      },
    );

    return { message: 'Unverified account permanently deleted.' };
  }
  /**
 * Users who completed registration (via invite or self-signup) but have
 * not yet verified their email — distinct from pending Invitations, which
 * only cover people who haven't registered at all yet.
 */
async listUnverifiedByRole(roles?: ('MEMBER' | 'ADMIN' | 'SUPER_ADMIN')[]) {
  return this.prisma.user.findMany({
    where: {
      deletedAt: null,
      emailVerified: false,
      ...(roles && roles.length ? { role: { in: roles } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}
}