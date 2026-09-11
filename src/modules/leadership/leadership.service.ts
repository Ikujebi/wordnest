import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import {
  LeadershipClass,
  LeadershipEnrollment,
  Prisma,
  NotificationType,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

import { CreateClassDto } from './dto/create-class.dto';
import { AwardBadgeDto } from './dto/award-badge.dto';
import { EnrollMemberDto } from './dto/enroll-member.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { RecordLeadershipAttendanceDto } from './dto/record-leadership-attendance.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { GradeAssignmentDto } from './dto/grade-assignment.dto';
import { FinalizeCohortDto } from './dto/finalize-cohort.dto';

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

  // ============================================================
  // CREATE LEADERSHIP CLASS
  // ============================================================

  /**
   * Initializes a structural training track course inside the ecosystem.
   */
  async createClass(dto: CreateClassDto, actorId?: string): Promise<LeadershipClass> {
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

      // Side-effects run safely in background without blocking core output
      this.safelyRunSideEffect(() =>
        this.notificationService.notifyAdmins({
          title: 'New Leadership Class Created',
          message: `Leadership class "${newClass.name}" has been created.`,
          type: NotificationType.INFO,
        }),
      );

      this.safelyRunSideEffect(() =>
        this.auditLogService.createLog(
          { id: actorId },
          {
            action: AuditAction.CREATE_LEADERSHIP_CLASS,
            entity: 'LeadershipClass',
            entityId: newClass.id,
            description: `Created leadership class "${newClass.name}"`,
            newValues: newClass,
          },
        ),
      );

      return newClass;
    } catch (error) {
      this.logger.error(
        'Failed to create academic leadership track',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Could not create leadership class framework.',
      );
    }
  }

  // ============================================================
  // ENROLL MEMBER
  // ============================================================

  /**
   * Registers an eligible worker to a leadership class.
   *
   * Only active workers are allowed to enroll.
   */
  async enrollMember(
    classId: string,
    dto: EnrollMemberDto,
    actorId?: string,
  ): Promise<LeadershipEnrollment> {
    const member = await this.prisma.member.findUnique({
      where: {
        id: dto.memberId,
      },
      select: {
        isWorker: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    if (!member.isWorker) {
      throw new ForbiddenException(
        'Only active workers are eligible to enroll in a leadership class.',
      );
    }

    try {
      const enrollment =
        await this.prisma.leadershipEnrollment.create({
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

      this.safelyRunSideEffect(() =>
        this.notificationService.notifyMember(dto.memberId, {
          title: 'Class Enrollment Successful',
          message: `You have been successfully enrolled in ${
            enrollment.class?.name || 'the leadership class'
          }.`,
          type: NotificationType.INFO,
        }),
      );

      this.safelyRunSideEffect(() =>
        this.auditLogService.createLog(
          { id: actorId },
          {
            action: AuditAction.ENROLL_LEADERSHIP_CLASS,
            entity: 'LeadershipEnrollment',
            entityId: enrollment.id,
            description: `Member ${dto.memberId} enrolled in leadership class ${classId}`,
            newValues: enrollment,
          },
        ),
      );

      return enrollment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'This member is already actively enrolled inside this class stream.',
          );
        }

        if (error.code === 'P2003') {
          throw new NotFoundException(
            'The targeted training class or member account record was not found.',
          );
        }
      }

      this.logger.error(
        `Enrollment execution breakdown for class target ID: ${classId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'System breakdown mapping roster execution profiles.',
      );
    }
  }

  // ============================================================
  // WITHDRAW STUDENT
  // ============================================================

  /**
   * Withdraws a student from a leadership class without deleting
   * the enrollment record.
   */
  async withdrawStudent(
    classId: string,
    memberId: string,
    actorId?: string,
  ): Promise<LeadershipEnrollment> {
    const existing =
      await this.prisma.leadershipEnrollment.findUnique({
        where: {
          classId_memberId: {
            classId,
            memberId,
          },
        },
        include: {
          class: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'No enrollment found for this student in this class.',
      );
    }

    const updated =
      await this.prisma.leadershipEnrollment.update({
        where: {
          classId_memberId: {
            classId,
            memberId,
          },
        },
        data: {
          status: 'WITHDRAWN',
        },
      });

    this.safelyRunSideEffect(() =>
      this.notificationService.notifyMember(memberId, {
        title: 'Removed from Leadership Class',
        message: `You have been withdrawn from ${
          existing.class?.name ?? 'a leadership class'
        }.`,
        type: NotificationType.INFO,
      }),
    );

    this.safelyRunSideEffect(() =>
      this.auditLogService.createLog(
        { id: actorId },
        {
          action: AuditAction.UPDATE_LEADERSHIP_PROGRESS,
          entity: 'LeadershipEnrollment',
          entityId: updated.id,
          description: `Withdrew member ${memberId} from class ${classId}`,
          oldValues: existing,
          newValues: updated,
        },
      ),
    );

    return updated;
  }

  // ============================================================
  // UPDATE STUDENT PROGRESS
  // ============================================================

  /**
   * Updates a student's leadership class progress or status.
   */
  async updateStudentTrack(
    classId: string,
    memberId: string,
    dto: UpdateProgressDto,
    actorId?: string,
  ): Promise<LeadershipEnrollment> {
    try {
      const updatedEnrollment =
        await this.prisma.leadershipEnrollment.update({
          where: {
            classId_memberId: {
              classId,
              memberId,
            },
          },
          data: {
            ...dto,
            ...(dto.status === 'COMPLETED'
              ? { completedAt: new Date() }
              : {}),
          },
          include: {
            class: true,
          },
        });

      const className =
        updatedEnrollment.class?.name || 'Leadership Class';

      this.safelyRunSideEffect(() =>
        this.notificationService.notifyMember(memberId, {
          title:
            dto.status === 'COMPLETED'
              ? 'Class Completed!'
              : 'Leadership Class Progress Updated',
          message:
            dto.status === 'COMPLETED'
              ? `Congratulations! You have successfully completed ${className}.`
              : `Your progress in ${className} has been updated to ${updatedEnrollment.progress}%.`,
          type: NotificationType.INFO,
        }),
      );

      this.safelyRunSideEffect(() =>
        this.auditLogService.createLog(
          { id: actorId },
          {
            action: AuditAction.UPDATE_LEADERSHIP_PROGRESS,
            entity: 'LeadershipEnrollment',
            entityId: updatedEnrollment.id,
            description: `Updated progress/status for member ${memberId} in class ${classId}`,
            newValues: updatedEnrollment,
          },
        ),
      );

      return updatedEnrollment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          'No active course registry matched for this student/course reference pair.',
        );
      }

      this.logger.error(
        `Failure processing score parameters for student ${memberId} in class ${classId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Roster compilation updates failed execution.',
      );
    }
  }

  // ============================================================
  // LEADERSHIP ATTENDANCE
  // ============================================================

  /**
   * Records or updates attendance for a member in a leadership session.
   */
  async recordAttendance(
    sessionId: string,
    dto: RecordLeadershipAttendanceDto,
    actorId?: string,
  ) {
    const session =
      await this.prisma.leadershipSession.findUnique({
        where: {
          id: sessionId,
        },
      });

    if (!session) {
      throw new NotFoundException(
        'Class session not found.',
      );
    }

    const attendance =
      await this.prisma.leadershipAttendance.upsert({
        where: {
          sessionId_memberId: {
            sessionId,
            memberId: dto.memberId,
          },
        },
        update: {
          status: dto.status,
        },
        create: {
          sessionId,
          memberId: dto.memberId,
          status: dto.status,
        },
      });

    this.safelyRunSideEffect(() =>
      this.auditLogService.createLog(
        { id: actorId },
        {
          action: AuditAction.RECORD_WORKER_ATTENDANCE,
          entity: 'LeadershipAttendance',
          entityId: attendance.id,
          description: `Recorded attendance (${dto.status}) for member ${dto.memberId} in session ${sessionId}`,
          newValues: attendance,
        },
      ),
    );

    return attendance;
  }

  /**
   * Returns attendance records for a leadership session.
   */
  async getSessionAttendance(sessionId: string) {
    const session =
      await this.prisma.leadershipSession.findUnique({
        where: {
          id: sessionId,
        },
      });

    if (!session) {
      throw new NotFoundException(
        'Class session not found.',
      );
    }

    return this.prisma.leadershipAttendance.findMany({
      where: {
        sessionId,
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // ============================================================
  // ASSIGNMENTS
  // ============================================================

  /**
   * Creates an assignment for a leadership class.
   */
  async createAssignment(
    classId: string,
    dto: CreateAssignmentDto,
    actorId?: string,
  ) {
    const klass =
      await this.prisma.leadershipClass.findUnique({
        where: {
          id: classId,
        },
      });

    if (!klass) {
      throw new NotFoundException(
        'Leadership class not found.',
      );
    }

    const assignment =
      await this.prisma.leadershipAssignment.create({
        data: {
          classId,
          title: dto.title,
          maxScore: dto.maxScore ?? 100,
        },
      });

    this.safelyRunSideEffect(() =>
      this.auditLogService.createLog(
        { id: actorId },
        {
          action: AuditAction.CREATE_LEADERSHIP_CLASS,
          entity: 'LeadershipAssignment',
          entityId: assignment.id,
          description: `Created assignment "${assignment.title}" for class ${classId}`,
          newValues: assignment,
        },
      ),
    );

    return assignment;
  }

  /**
   * Lists all assignments belonging to a leadership class.
   */
  async listAssignments(classId: string) {
    return this.prisma.leadershipAssignment.findMany({
      where: {
        classId,
      },
      include: {
        grades: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // ============================================================
  // GRADE ASSIGNMENT
  // ============================================================

  /**
   * Creates or updates a student's grade for an assignment.
   */
  async gradeAssignment(
    assignmentId: string,
    dto: GradeAssignmentDto,
    gradedById: string,
  ) {
    const assignment =
      await this.prisma.leadershipAssignment.findUnique({
        where: {
          id: assignmentId,
        },
      });

    if (!assignment) {
      throw new NotFoundException(
        'Assignment not found.',
      );
    }

    if (dto.score > assignment.maxScore) {
      throw new BadRequestException(
        `Score cannot exceed the assignment's max score of ${assignment.maxScore}.`,
      );
    }

    const grade =
      await this.prisma.leadershipGrade.upsert({
        where: {
          assignmentId_memberId: {
            assignmentId,
            memberId: dto.memberId,
          },
        },
        update: {
          score: dto.score,
          gradedById,
          gradedAt: new Date(),
        },
        create: {
          assignmentId,
          memberId: dto.memberId,
          score: dto.score,
          gradedById,
        },
      });

    this.safelyRunSideEffect(() =>
      this.notificationService.notifyMember(
        dto.memberId,
        {
          title: 'Assignment Graded',
          message: `You scored ${dto.score}/${assignment.maxScore} on "${assignment.title}".`,
          type: NotificationType.INFO,
        },
      ),
    );

    this.safelyRunSideEffect(() =>
      this.auditLogService.createLog(
        { id: gradedById },
        {
          action: AuditAction.UPDATE_LEADERSHIP_PROGRESS,
          entity: 'LeadershipGrade',
          entityId: grade.id,
          description: `Graded member ${dto.memberId} ${dto.score}/${assignment.maxScore} on "${assignment.title}"`,
          newValues: grade,
        },
      ),
    );

    return grade;
  }

  // ============================================================
  // FINALIZE COHORT
  // ============================================================

  /**
   * Finalizes a leadership cohort.
   *
   * Graduated members receive the leadership badge
   * corresponding to the class level.
   */
  async finalizeCohort(
    classId: string,
    dto: FinalizeCohortDto,
    adminId: string,
  ) {
    const klass =
      await this.prisma.leadershipClass.findUnique({
        where: {
          id: classId,
        },
      });

    if (!klass) {
      throw new NotFoundException(
        'Leadership class not found.',
      );
    }

    const graduatedMemberIds = dto.results
      .filter((r) => r.graduated)
      .map((r) => r.memberId);

    const results = await this.prisma.$transaction(
      async (tx) => {
        // Optimized bulk badge assignment
        if (graduatedMemberIds.length > 0) {
          await tx.member.updateMany({
            where: { id: { in: graduatedMemberIds } },
            data: { leadershipBadge: klass.level },
          });
        }

        return Promise.all(
          dto.results.map((r) => {
            const status = r.graduated
              ? 'GRADUATED'
              : 'NOT_GRADUATED';

            return tx.leadershipEnrollment.update({
              where: {
                classId_memberId: {
                  classId,
                  memberId: r.memberId,
                },
              },
              data: {
                status,
                completedAt: new Date(),
              },
            });
          }),
        );
      },
    );

    const graduatedCount = graduatedMemberIds.length;

    // Send notifications concurrently outside database locks
    this.safelyRunSideEffect(async () => {
      await Promise.allSettled(
        dto.results.map((r) =>
          this.notificationService.notifyMember(
            r.memberId,
            {
              title: r.graduated
                ? 'Congratulations — You Graduated!'
                : 'Cohort Concluded',
              message: r.graduated
                ? `You have successfully graduated from ${klass.name} and earned the ${klass.level} badge.`
                : `${klass.name} has concluded. You did not meet the graduation requirements this cohort.`,
              type: NotificationType.INFO,
            },
          ),
        ),
      );
    });

    this.safelyRunSideEffect(() =>
      this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.UPDATE_LEADERSHIP_PROGRESS,
          entity: 'LeadershipClass',
          entityId: classId,
          description: `Finalized cohort "${klass.name}": ${graduatedCount}/${dto.results.length} graduated.`,
          metadata: {
            results: dto.results,
          },
        },
      ),
    );

    return {
      message: 'Cohort finalized.',
      graduated: graduatedCount,
      total: dto.results.length,
      enrollments: results,
    };
  }

  // ============================================================
  // CLASS ROSTER
  // ============================================================

  /**
   * Returns the complete roster for a leadership class.
   */
  async getClassRoster(classId: string) {
    const klass =
      await this.prisma.leadershipClass.findUnique({
        where: {
          id: classId,
        },
      });

    if (!klass) {
      throw new NotFoundException(
        'Leadership class not found.',
      );
    }

    return this.prisma.leadershipEnrollment.findMany({
      where: {
        classId,
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            leadershipBadge: true,
          },
        },
      },
      orderBy: {
        enrolledAt: 'asc',
      },
    });
  }

  // ============================================================
  // PRIVATE UTILITIES
  // ============================================================

  /**
   * Wrapper to prevent non-critical background side effects
   * (notifications, logs) from throwing exceptions and interrupting
   * primary database operations.
   */
  private safelyRunSideEffect(action: () => Promise<unknown>): void {
    action().catch((err) => {
      this.logger.error(
        'Background side-effect failed execution:',
        err instanceof Error ? err.stack : String(err),
      );
    });
  }
  /**
 * Directly awards a leadership badge without requiring class enrollment
 * or cohort finalization — for members/admins who already completed
 * equivalent leadership formation before this system tracked it.
 * Super Admin only; deliberately bypasses the enrollment pipeline.
 */
async awardBadgeDirectly(dto: AwardBadgeDto, adminId: string) {
  const member = await this.prisma.member.findUnique({ where: { id: dto.memberId } });
  if (!member || member.deletedAt) {
    throw new NotFoundException('Member not found.');
  }

  const previousBadge = member.leadershipBadge;

  const updated = await this.prisma.member.update({
    where: { id: dto.memberId },
    data: { leadershipBadge: dto.level },
  });

  await this.notificationService.notifyMember(dto.memberId, {
    title: 'Leadership Badge Awarded',
    message: `You've been awarded the ${dto.level} leadership badge${dto.reason ? `: ${dto.reason}` : '.'}`,
    type: NotificationType.INFO,
  });

  await this.auditLogService.createLog(
    { id: adminId },
    {
      action: AuditAction.UPDATE_LEADERSHIP_PROGRESS,
      entity: 'Member',
      entityId: dto.memberId,
      description: `Manually awarded ${dto.level} leadership badge to member ${dto.memberId}${dto.reason ? ` — ${dto.reason}` : ''}`,
      oldValues: { leadershipBadge: previousBadge },
      newValues: { leadershipBadge: updated.leadershipBadge },
    },
  );

  return updated;
}
}