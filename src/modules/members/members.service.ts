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
import { NotificationService } from '../notifications/notification.service';

export interface BirthdayMemberDto {
  id: string;
  name: string;
  avatarUrl: string | null;
  timing: 'today' | 'tomorrow';
  dateOfBirth?: string;
}

export interface MemberQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  approvalStatus?: string;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Fetch paginated list of active church members for the directory.
   */
  async findAll(query: MemberQueryDto = {}) {
    const { page = 1, limit = 10, search, approvalStatus } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(approvalStatus && {
        user: {
          approvalStatus: approvalStatus as any,
        },
      }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: {
              id: true,
              role: true,
              approvalStatus: true,
              isActive: true,
              profilePictureUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Fetch members with upcoming birthdays today/tomorrow.
   * Joins the User table to retrieve profilePictureUrl.
   */
  async getUpcomingBirthdays(): Promise<BirthdayMemberDto[]> {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const tomorrowMonth = tomorrow.getMonth() + 1;
    const tomorrowDay = tomorrow.getDate();

    try {
      const rawMembers = await this.prisma.$queryRaw<
        Array<{
          id: string;
          firstName: string;
          lastName: string;
          profilePictureUrl: string | null;
          dateOfBirth: Date;
        }>
      >`
        SELECT 
          m.id, 
          m."firstName", 
          m."lastName", 
          u."profilePictureUrl", 
          m."dateOfBirth"
        FROM "Member" m
        LEFT JOIN "User" u ON m."userId" = u.id
        WHERE m."deletedAt" IS NULL
          AND m."dateOfBirth" IS NOT NULL
          AND (
            (EXTRACT(MONTH FROM m."dateOfBirth") = ${todayMonth} AND EXTRACT(DAY FROM m."dateOfBirth") = ${todayDay})
            OR
            (EXTRACT(MONTH FROM m."dateOfBirth") = ${tomorrowMonth} AND EXTRACT(DAY FROM m."dateOfBirth") = ${tomorrowDay})
          );
      `;

      return rawMembers.map((member) => {
        const dob = new Date(member.dateOfBirth);
        const isToday =
          dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;

        return {
          id: member.id,
          name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
          avatarUrl: member.profilePictureUrl ?? null,
          timing: isToday ? 'today' : 'tomorrow',
          dateOfBirth: member.dateOfBirth.toISOString(),
        };
      });
    } catch (error) {
      this.logger.error(
        'Failed to fetch upcoming birthdays',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Unable to retrieve upcoming birthdays.',
      );
    }
  }

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
    const existingMember = await this.findByUserId(userId);

    const data: Prisma.MemberUpdateInput = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const mem = await tx.member.update({
          where: { userId },
          data,
        });

        if (dto.email && dto.email.trim().toLowerCase() !== existingMember.email) {
          await tx.user.update({
            where: { id: userId },
            data: { email: dto.email.trim().toLowerCase() },
          });
        }

        return mem;
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

  async findById(id: string): Promise<Member> {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!member || member.deletedAt !== null) {
      throw new NotFoundException(
        `Member with ID ${id} not found or has been soft-deleted.`,
      );
    }

    return member;
  }

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
    const member = await this.findById(id);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.member.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      if (member.userId) {
        await tx.user.update({
          where: { id: member.userId },
          data: { isActive: false, deletedAt: new Date() },
        });
      }

      return deleted;
    });
  }

  async restoreMember(id: string): Promise<Member> {
    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.member.update({
        where: { id },
        data: { deletedAt: null },
      });

      if (restored.userId) {
        await tx.user.update({
          where: { id: restored.userId },
          data: { isActive: true, deletedAt: null },
        });
      }

      return restored;
    });
  }
}