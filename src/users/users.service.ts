import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPaginationQueryDto } from './dto/user-pagination-query.dto';
import { USER_ERROR_MESSAGES } from './users.constants';

import * as bcrypt from 'bcrypt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

// Remove sensitive fields from API response
export type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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
}