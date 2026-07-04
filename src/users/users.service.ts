import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '../../app/generated/prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPaginationQueryDto } from './dto/user-pagination-query.dto';
import { USER_ERROR_MESSAGES } from './users.constants';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

// Type utility mapping perfectly to the fully instantiated model minus sensitive credentials
export type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

constructor(
  private readonly prisma: PrismaService,
  private readonly cloudinaryService: CloudinaryService,
) {}
  /**
   * Get all users matching the pagination and filter criteria.
   */
  async findAll(query: UserPaginationQueryDto): Promise<User[]> {
    const { page, limit, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      deletedAt: null, // Always exclude soft-deleted records in main listings
      ...(isActive !== undefined && { isActive }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        member: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get an active user by ID.
   */
  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { 
        id,
        deletedAt: null, // Prevent access if soft-deleted
      },
      include: {
        member: true,
      },
    });

    if (!user) {
      throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
    }

    return user;
  }

  /**
   * Clear-text lookup by email (useful for Auth strategy validation).
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
      include: {
        member: true,
      },
    });
  }

  /**
   * Create a new user with proper safety guards against race conditions.
   */
  async create(createUserDto: CreateUserDto): Promise<SanitizedUser> {
    const { password, ...userData } = createUserDto;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const newUser = await this.prisma.user.create({
        data: {
          ...userData,
          passwordHash,
        },
      });

      // Safely discard the password hash while implicitly retaining all other model properties
      const { passwordHash: _, ...sanitizedUser } = newUser;
      return sanitizedUser;
    } catch (error) {
      // P2002: Unique constraint violation (e.g., email duplicate)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email address already exists.');
      }

      this.logger.error(
        'Failed to create user', 
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException('Could not create user account.');
    }
  }

  /**
   * Update partial fields on a user record.
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const data: Prisma.UserUpdateInput = {};

    if (updateUserDto.fullName) data.fullName = updateUserDto.fullName.trim();
    if (updateUserDto.email) data.email = updateUserDto.email.trim().toLowerCase();
    if (updateUserDto.role) data.role = updateUserDto.role;
    if (updateUserDto.isActive !== undefined) data.isActive = updateUserDto.isActive;

    try {
      return await this.prisma.user.update({
        // The where condition guarantees an error throws instantly if target is soft-deleted
        where: { id, deletedAt: null },
        data,
        include: {
          member: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record to update not found or fails where clause requirements
        if (error.code === 'P2025') {
          throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
        }
        // P2002: Unique constraint failed during email reallocation
        if (error.code === 'P2002') {
          throw new ConflictException('An account with this email address already exists.');
        }
      }

      this.logger.error(
        `Failed to update user ID: ${id}`, 
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException('An unexpected database error occurred.');
    }
  }

  /**
 * Upload or replace a user's profile picture.
 */
async updateProfilePicture(
  id: string,
  file: Express.Multer.File,
): Promise<User> {
  const user = await this.prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
  }

  try {
    // Delete existing profile picture from Cloudinary
    if (user.profilePicturePublicId) {
      await this.cloudinaryService.deleteFile(
        user.profilePicturePublicId,
      );
    }

    // Upload the new profile picture
    const uploaded = await this.cloudinaryService.uploadFile(
      file,
      'profile-pictures',
    );

    // Update the user record
    const updatedUser = await this.prisma.user.update({
      where: {
        id,
      },
      data: {
        profilePictureUrl: uploaded.secure_url,
        profilePicturePublicId: uploaded.public_id,
      },
      include: {
        member: true,
      },
    });

    return updatedUser;
  } catch (error) {
    this.logger.error(
      `Failed to update profile picture for user ${id}`,
      error instanceof Error ? error.stack : String(error),
    );

    throw new InternalServerErrorException(
      'Failed to update profile picture.',
    );
  }
}

  /**
   * Safely soft-deletes an entity from the active dataset.
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id, deletedAt: null },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      // Intercept missing records gracefully rather than emitting 500 runtime logs
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(USER_ERROR_MESSAGES.NOT_FOUND);
      }

      this.logger.error(
        `Failed to soft delete user ID: ${id}`, 
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException('An unexpected database error occurred.');
    }
  }
}