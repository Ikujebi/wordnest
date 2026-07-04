import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Member, Prisma } from '../../../app/generated/prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ties a physical member profile to an authenticated system user.
   */
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('This user account is already linked to a member profile.');
        }
      }
      this.logger.error(`Failed to create member profile for user ID: ${userId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An error occurred while creating the member profile.');
    }
  }

  /**
   * Retrieves a member record along with its core system account references.
   */
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

  /**
   * Updates partial member fields atomically.
   */
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
}