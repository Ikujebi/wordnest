import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPaginationQueryDto } from './dto/user-pagination-query.dto';
import { USER_ERROR_MESSAGES } from './users.constants';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { AuditAction } from '../modules/audit-log/enums/audit-action.enum';

export type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: UserPaginationQueryDto): Promise<User[]> {
    const { page = 1, limit = 10, search, role, isActive } = query;
    const skip = (Number(page) - 1) * Number(limit);

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
      take: Number(limit),
      include: { member: true },
      orderBy: { createdAt: 'desc' },
    });
  }

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

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
      include: { member: true },
    });
  }

  async create(dto: CreateUserDto): Promise<SanitizedUser> {
    const { password, fullName, email, phoneNumber, ...data } = dto;
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            ...data,
            fullName: fullName.trim(),
            email: normalizedEmail,
            phoneNumber: phoneNumber?.trim() ?? null,
            passwordHash,
            member: {
              create: {
                firstName,
                lastName,
                email: normalizedEmail,
                phoneNumber: phoneNumber?.trim() ?? null,
              },
            },
          },
          include: { member: true },
        });
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

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.fullName) data.fullName = dto.fullName.trim();
    if (dto.email) data.email = dto.email.trim().toLowerCase();
    if (dto.role) data.role = dto.role;
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data,
          include: { member: true },
        });

        if (updatedUser.member) {
          const memberData: Prisma.MemberUpdateInput = {};
          if (dto.email) memberData.email = dto.email.trim().toLowerCase();
          if (dto.fullName) {
            const nameParts = dto.fullName.trim().split(' ');
            memberData.firstName = nameParts[0];
            memberData.lastName = nameParts.slice(1).join(' ') || '';
          }

          if (Object.keys(memberData).length > 0) {
            await tx.member.update({
              where: { id: updatedUser.member.id },
              data: memberData,
            });
          }
        }

        return updatedUser;
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
        await this.cloudinaryService.deleteFile(user.profilePicturePublicId);
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

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            isActive: false,
            deletedAt: new Date(),
          },
        });

        await tx.member.updateMany({
          where: { userId: id },
          data: { deletedAt: new Date() },
        });
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

  async getUpcomingBirthdays(daysAhead: number = 30) {
    try {
      return await this.prisma.$queryRaw`
        SELECT 
          m.id, 
          m."firstName", 
          m."lastName", 
          m."dob", 
          u."profilePictureUrl"
        FROM "Member" m
        LEFT JOIN "User" u ON m."userId" = u.id
        WHERE m."deletedAt" IS NULL
          AND m."dob" IS NOT NULL
          AND (
            (EXTRACT(DOY FROM m."dob") - EXTRACT(DOY FROM CURRENT_DATE) + 365) % 365
          ) <= ${daysAhead}
        ORDER BY 
          ((EXTRACT(DOY FROM m."dob") - EXTRACT(DOY FROM CURRENT_DATE) + 365) % 365) ASC;
      `;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Failed to fetch upcoming birthdays.');
    }
  }
}