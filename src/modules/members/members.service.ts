import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Member, Prisma, NotificationType } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

// Note: Ensure NotificationService and NotificationType are imported correctly
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService, // 👈 Added missing injection
  ) {}

  async createMemberProfile(
    userId: string,
    dto: CreateMemberDto,
  ): Promise<Member> {
    try {
      const member = await this.prisma.member.create({
        data: {
          ...dto,
          userId,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        },
      });

      await this.notificationService.notify(userId, {
        title: 'Welcome!',
        message: 'Your church member profile has been created successfully.',
        type: NotificationType.SYSTEM,
      });

      return member;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This user account is already linked to a member profile.',
        );
      }

      this.logger.error(
        `Failed to create member profile for ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'An error occurred while creating the member profile.',
      );
    }
  }

  async findByUserId(userId: string): Promise<Member> {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!member || member.deletedAt !== null) {
      throw new NotFoundException('Member profile not found.');
    }

    return member;
  }

  async updateMemberProfile(
    userId: string,
    dto: UpdateMemberDto,
  ): Promise<Member> {
    await this.findByUserId(userId); // Validates existence

    const data: Prisma.MemberUpdateInput = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };

    try {
      const updated = await this.prisma.member.update({
        where: { userId },
        data,
      });

      await this.notificationService.notify(userId, {
        title: 'Profile Updated',
        message: 'Your member profile was updated successfully.',
        type: NotificationType.SYSTEM,
      });

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Member profile not found.');
      }

      this.logger.error(
        `Failed updating member ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to update member profile.',
      );
    }
  }

  /**
   * 🔥 PRODUCTION ADDITION: Find a specific member by their primary Member ID.
   */
  async findById(id: string): Promise<Member> {
    const member = await this.prisma.member.findUnique({
      where: { id, deletedAt: null },
    });
    if (!member) {
      throw new NotFoundException(
        `Member with ID ${id} not found or has been soft-deleted.`,
      );
    }
    return member;
  }

  /**
   * 🔥 PRODUCTION ADDITION: Validate if an array of Member IDs exist and are active.
   * Useful to run before firing off communications.
   */
  async validateManyMembers(memberIds: string[]): Promise<void> {
    const count = await this.prisma.member.count({
      where: {
        id: { in: memberIds },
        deletedAt: null,
      },
    });

    if (count !== memberIds.length) {
      throw new NotFoundException(
        'One or more targeted members could not be found or are inactive.',
      );
    }
  }

  async softDeleteMember(id: string): Promise<Member> {
    await this.findById(id); // Validates existence

    return this.prisma.member.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async restoreMember(id: string): Promise<Member> {
    return this.prisma.member.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });
  }
}