import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Member, Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMemberProfile(userId: string, dto: CreateMemberDto): Promise<Member> {
    try {
      return await this.prisma.member.create({
        data: {
          ...dto,
          userId,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This user account is already linked to a member profile.');
      }
      this.logger.error(`Failed to create member profile for user ID: ${userId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An error occurred while creating the member profile.');
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

  async updateMemberProfile(userId: string, dto: UpdateMemberDto): Promise<Member> {
    const data: Prisma.MemberUpdateInput = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };

    try {
      return await this.prisma.member.update({
        where: { userId },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Member profile not found or is inactive.');
      }
      this.logger.error(`Failed to update member profile for user ID: ${userId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An error occurred updating your profile information.');
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
      throw new NotFoundException(`Member with ID ${id} not found or has been soft-deleted.`);
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
      throw new NotFoundException('One or more targeted members could not be found or are inactive.');
    }
  }
}