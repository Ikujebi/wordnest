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

/* Return shape expected by your BirthdaysWidget frontend component */
export interface BirthdayMemberDto {
  id: string;
  name: string;
  avatarUrl: string | null;
  timing: 'today' | 'tomorrow';
  dateOfBirth?: string;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Fetch members whose birthday falls on today or tomorrow (excluding soft-deleted members).
   */
  async getUpcomingBirthdays(): Promise<BirthdayMemberDto[]> {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayMonth = today.getMonth() + 1; // JS months are 0-indexed
    const todayDay = today.getDate();

    const tomorrowMonth = tomorrow.getMonth() + 1;
    const tomorrowDay = tomorrow.getDate();

    try {
      // Query Postgres for matching Month/Day, filtering out soft-deleted members
      const rawMembers = await this.prisma.$queryRaw<
        Array<{
          id: string;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
          dateOfBirth: Date;
        }>
      >`
        SELECT id, "firstName", "lastName", "avatarUrl", "dateOfBirth"
        FROM "Member"
        WHERE "deletedAt" IS NULL
          AND "dateOfBirth" IS NOT NULL
          AND (
            (EXTRACT(MONTH FROM "dateOfBirth") = ${todayMonth} AND EXTRACT(DAY FROM "dateOfBirth") = ${todayDay})
            OR
            (EXTRACT(MONTH FROM "dateOfBirth") = ${tomorrowMonth} AND EXTRACT(DAY FROM "dateOfBirth") = ${tomorrowDay})
          );
      `;

      return rawMembers.map((member) => {
        const dob = new Date(member.dateOfBirth);
        const isToday =
          dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;

        return {
          id: member.id,
          name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
          avatarUrl: member.avatarUrl,
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