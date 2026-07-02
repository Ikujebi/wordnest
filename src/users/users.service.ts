import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '../../app/generated/prisma/client';
import { CreateUserDto } from './dto/create-user.dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active users.
   */
  async findAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
      },
      include: {
        member: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a user by ID.
   */
  async findUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        member: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  /**
   * Get a user by email.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  /**
   * Create a new user.
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const email = createUserDto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(
        `A user with email "${email}" already exists.`,
      );
    }

    try {
      return await this.prisma.user.create({
        data: {
          email,
          fullName: createUserDto.fullName.trim(),
        },
      });
    } catch (error) {
      // Handles race conditions where another request creates the same email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists.');
      }

      this.logger.error('Failed to create user.', error);

      throw error;
    }
  }

  /**
   * Soft deactivate a user.
   */
  async deactivateUser(id: string): Promise<User> {
    await this.findUserById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}