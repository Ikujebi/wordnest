import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadershipClass, LeadershipEnrollment, Prisma } from '@prisma/client';
import { CreateClassDto } from './dto/create-class.dto';
import { EnrollMemberDto } from './dto/enroll-member.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Injectable()
export class LeadershipService {
  private readonly logger = new Logger(LeadershipService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes a structural training track course inside the ecosystem.
   */
  async createClass(dto: CreateClassDto): Promise<LeadershipClass> {
    try {
      return await this.prisma.leadershipClass.create({
        data: {
          ...dto,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create academic leadership track', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not create leadership class framework.');
    }
  }

  /**
   * Registers a member profile to a specific training program course stream.
   */
  async enrollMember(classId: string, dto: EnrollMemberDto): Promise<LeadershipEnrollment> {
    try {
      return await this.prisma.leadershipEnrollment.create({
        data: {
          classId,
          memberId: dto.memberId,
          status: 'IN_PROGRESS',
          progress: 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint failed (e.g., student is already enrolled in this exact course track)
        if (error.code === 'P2002') {
          throw new ConflictException('This member is already actively enrolled inside this class stream.');
        }
        // P2003: Foreign key reference failure
        if (error.code === 'P2003') {
          throw new NotFoundException('The targeted training class or member account record was not found.');
        }
      }
      this.logger.error(`Enrollment execution breakdown for class target ID: ${classId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('System breakdown mapping roster execution profiles.');
    }
  }

  /**
   * Atomic mutation path adjusting course grading scales or structural certification parameters.
   */
  async updateStudentTrack(classId: string, memberId: string, dto: UpdateProgressDto): Promise<LeadershipEnrollment> {
    const data: Prisma.LeadershipEnrollmentUpdateInput = {
      ...dto,
      ...(dto.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
    };

    try {
      return await this.prisma.leadershipEnrollment.update({
        where: {
          classId_memberId: { classId, memberId },
        },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('No active course registry matched for this student/course reference pair.');
      }
      this.logger.error(`Failure processing score parameters for student ${memberId} in class ${classId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Roster compilation updates failed execution.');
    }
  }
}