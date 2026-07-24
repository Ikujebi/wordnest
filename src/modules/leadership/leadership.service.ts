import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadershipClass, LeadershipEnrollment, Prisma, NotificationType } from '@prisma/client';
import { CreateClassDto } from './dto/create-class.dto';
import { EnrollMemberDto } from './dto/enroll-member.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';

@Injectable()
export class LeadershipService {
  private readonly logger = new Logger(LeadershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Initializes a structural training track course inside the ecosystem.
   */
  async createClass(dto: CreateClassDto): Promise<LeadershipClass> {
    try {
      const newClass = await this.prisma.leadershipClass.create({
        data: {
          name: dto.title,
          level: dto.level,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
          facilitatorId: dto.facilitatorId ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
      });

      // 1. Notify Admins
      await this.notificationService.notifyAdmins({
        title: 'New Leadership Class Created',
        message: `Leadership class "${newClass.name}" has been created.`,
        type: NotificationType.INFO,
      });

      // 2. Audit Log
      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.CREATE_LEADERSHIP_CLASS,
          entity: 'LeadershipClass',
          entityId: newClass.id,
          description: `Created leadership class "${newClass.name}"`,
          newValues: newClass,
        },
      );

      return newClass;
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
      const enrollment = await this.prisma.leadershipEnrollment.create({
        data: {
          classId,
          memberId: dto.memberId,
          status: 'IN_PROGRESS',
          progress: 0,
        },
        include: {
          class: true,
        },
      });

      // 1. Notify the Member
      await this.notificationService.notifyMember(dto.memberId, {
        title: 'Class Enrollment Successful',
        message: `You have been successfully enrolled in ${enrollment.class?.name || 'the leadership class'}.`,
        type: NotificationType.INFO,
      });

      // 2. Audit Log
      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.ENROLL_LEADERSHIP_CLASS,
          entity: 'LeadershipEnrollment',
          entityId: enrollment.id,
          description: `Member ${dto.memberId} enrolled in leadership class ${classId}`,
          newValues: enrollment,
        },
      );

      return enrollment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('This member is already actively enrolled inside this class stream.');
        }
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
    try {
      const existingEnrollment = await this.prisma.leadershipEnrollment.findUnique({
        where: {
          classId_memberId: { classId, memberId },
        },
        include: {
          class: true,
        },
      });

      if (!existingEnrollment) {
        throw new NotFoundException('No active course registry matched for this student/course reference pair.');
      }

      const before = { ...existingEnrollment };

      const data: Prisma.LeadershipEnrollmentUpdateInput = {
        ...dto,
        ...(dto.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      };

      const updatedEnrollment = await this.prisma.leadershipEnrollment.update({
        where: {
          classId_memberId: { classId, memberId },
        },
        data,
      });

      const className = existingEnrollment.class?.name || 'Leadership Class';

      // 1. Send member notifications based on status/progress changes
      if (dto.status === 'COMPLETED') {
        await this.notificationService.notifyMember(memberId, {
          title: 'Class Completed!',
          message: `Congratulations! You have successfully completed ${className}.`,
          type: NotificationType.INFO,
        });
      } else {
        await this.notificationService.notifyMember(memberId, {
          title: 'Leadership Class Progress Updated',
          message: `Your progress in ${className} has been updated to ${updatedEnrollment.progress}%.`,
          type: NotificationType.INFO,
        });
      }

      // 2. Audit Log
      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.UPDATE_LEADERSHIP_PROGRESS,
          entity: 'LeadershipEnrollment',
          entityId: updatedEnrollment.id,
          description: `Updated progress/status for member ${memberId} in class ${classId}`,
          oldValues: before,
          newValues: updatedEnrollment,
        },
      );

      return updatedEnrollment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('No active course registry matched for this student/course reference pair.');
      }
      this.logger.error(`Failure processing score parameters for student ${memberId} in class ${classId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Roster compilation updates failed execution.');
    }
  }
}