// src/departments/departments.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Department,
  DepartmentMember,
  DepartmentRole,
  Prisma,
  NotificationType,
} from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
import { AssignDepartmentLeaderDto } from './dto/assign-department-leader.dto';
import { DepartmentPerformanceDto } from './dto/department-performance.dto';
import { RecordMetricEntryDto } from './dto/record-metric-entry.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { SetDepartmentMetricsDto } from './dto/set-department-metrics.dto';
import slugify from 'slugify';

@Injectable()
export class DepartmentsService implements OnModuleInit {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new operational department alongside its unique search slug.
   */
  async create(
    dto: CreateDepartmentDto,
    creatorId: string,
  ): Promise<Department> {
    const slug = slugify(dto.name, { lower: true, strict: true });

    try {
      const department = await this.prisma.department.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          leaderId: dto.leaderId,
          createdById: creatorId,
        },
      });

      await this.auditLogService.createLog(
        { id: creatorId },
        {
          action: AuditAction.CREATE_DEPARTMENT,
          entity: 'Department',
          entityId: department.id,
          description: `Department "${department.name}" was created.`,
          newValues: department,
        },
      );

      await this.notificationService.notifySuperAdmins({
        title: 'New Department Created',
        message: `Department "${department.name}" has been created.`,
        type: NotificationType.SYSTEM,
      });

      if (dto.leaderId) {
        await this.notificationService.notifyMember(dto.leaderId, {
          title: 'Department Leadership Assignment',
          message: `You have been designated as the leader of ${department.name}.`,
          type: NotificationType.SYSTEM,
        });
      }

      return department;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A department with this name or slug already exists.',
        );
      }
      this.logger.error(
        'Failed to create department',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'An unexpected database error occurred.',
      );
    }
  }

  async findAll(): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        leader: true,
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(id: string): Promise<Department> {
    const department = await this.prisma.department.findUnique({
      where: { id, deletedAt: null },
      include: {
        leader: true,
        _count: { select: { members: true } },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    return department;
  }

  async assignLeader(
    departmentId: string,
    dto: AssignDepartmentLeaderDto,
    updaterId: string,
  ): Promise<Department> {
    const { leaderId } = dto;

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
      include: { leader: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    const candidateMember = await this.prisma.departmentMember.findUnique({
      where: {
        memberId_departmentId: {
          memberId: leaderId,
          departmentId,
        },
      },
      include: {
        member: true,
      },
    });

    if (
      !candidateMember ||
      candidateMember.deletedAt ||
      candidateMember.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'The designated leader must be an active member of this department.',
      );
    }

    try {
      const updatedDepartment = await this.prisma.$transaction(async (tx) => {
        if (department.leaderId && department.leaderId !== leaderId) {
          await tx.departmentMember.updateMany({
            where: {
              departmentId,
              memberId: department.leaderId,
              role: DepartmentRole.LEADER,
            },
            data: {
              role: DepartmentRole.MEMBER,
              updatedById: updaterId,
            },
          });
        }

        await tx.departmentMember.update({
          where: {
            memberId_departmentId: {
              memberId: leaderId,
              departmentId,
            },
          },
          data: {
            role: DepartmentRole.LEADER,
            updatedById: updaterId,
          },
        });

        return tx.department.update({
          where: { id: departmentId },
          data: {
            leaderId,
            updatedById: updaterId,
          },
          include: {
            leader: true,
            members: true,
          },
        });
      });

      await this.auditLogService.createLog(
        { id: updaterId },
        {
          action: AuditAction.UPDATE_DEPARTMENT,
          entity: 'Department',
          entityId: department.id,
          description: `Assigned ${candidateMember.member.firstName} ${candidateMember.member.lastName} as leader of department "${department.name}".`,
          oldValues: { leaderId: department.leaderId },
          newValues: { leaderId: updatedDepartment.leaderId },
        },
      );

      await this.notificationService.notifyMember(leaderId, {
        title: 'Department Leadership Assignment',
        message: `You have been assigned as the Department Leader for ${department.name}.`,
        type: NotificationType.SYSTEM,
      });

      return updatedDepartment;
    } catch (error) {
      this.logger.error(
        `Failed to assign leader ${leaderId} to department ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to update department leader assignment.',
      );
    }
  }

  async addMember(
    departmentId: string,
    dto: AddDepartmentMemberDto,
    creatorId: string,
  ): Promise<DepartmentMember> {
    try {
      const isActiveAssignment = dto.status ? dto.status === 'ACTIVE' : true;

      const existingWorker = isActiveAssignment
        ? await this.prisma.worker.findUnique({
            where: { memberId: dto.memberId },
          })
        : null;
      const isNewWorker =
        isActiveAssignment &&
        (!existingWorker || existingWorker.deletedAt !== null);

      const { departmentMember, worker } = await this.prisma.$transaction(
        async (tx) => {
          const departmentMember = await tx.departmentMember.create({
            data: {
              departmentId,
              memberId: dto.memberId,
              role: dto.role,
              status: dto.status,
              createdById: creatorId,
            },
            include: {
              department: true,
            },
          });

          let worker: Prisma.WorkerGetPayload<{}> | null = null;

          if (isActiveAssignment) {
            worker = await tx.worker.upsert({
              where: { memberId: dto.memberId },
              update: {
                departmentId,
                isActive: true,
                deletedAt: null,
              },
              create: {
                memberId: dto.memberId,
                departmentId,
                isActive: true,
              },
            });

            await tx.member.update({
              where: { id: dto.memberId },
              data: { isWorker: true },
            });
          }

          return { departmentMember, worker };
        },
      );

      await this.auditLogService.createLog(
        { id: creatorId },
        {
          action: AuditAction.ADD_DEPARTMENT_MEMBER,
          entity: 'DepartmentMember',
          entityId: departmentMember.id,
          description: `Member ${dto.memberId} added to department ${departmentMember.department.name} with role ${dto.role}.`,
          newValues: departmentMember,
        },
      );

      if (worker && isNewWorker) {
        await this.auditLogService.createLog(
          { id: creatorId },
          {
            action: AuditAction.CREATE_WORKER,
            entity: 'Worker',
            entityId: worker.id,
            description: `Member ${dto.memberId} automatically registered as a worker via department assignment.`,
            newValues: worker,
          },
        );
      }

      await this.notificationService.notifyMember(dto.memberId, {
        title: 'Department Assignment',
        message: `You have been added to the ${departmentMember.department.name} department as ${dto.role}.`,
        type: NotificationType.ANNOUNCEMENT,
      });

      return departmentMember;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This member is already registered in this department.',
        );
      }
      this.logger.error(
        `Failed to assign member to department ID: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred assigning the member roster.',
      );
    }
  }

  async updateMemberAssignment(
    departmentId: string,
    memberId: string,
    dto: UpdateDepartmentMemberDto,
    updaterId: string,
  ): Promise<DepartmentMember> {
    const data: Prisma.DepartmentMemberUpdateInput = {
      ...dto,
      updatedById: updaterId,
      ...(dto.status === 'INACTIVE' ? { leftAt: new Date() } : {}),
      ...(dto.status === 'ACTIVE' ? { leftAt: null } : {}),
    };

    try {
      const existingMember = await this.prisma.departmentMember.findUnique({
        where: { memberId_departmentId: { memberId, departmentId } },
        include: { department: true },
      });

      if (!existingMember || existingMember.deletedAt) {
        throw new NotFoundException(
          'Active roster record for this member and department combination not found.',
        );
      }

      const statusChanging =
        dto.status !== undefined && dto.status !== existingMember.status;

      const { updatedMember, workerStatusChanged } =
        await this.prisma.$transaction(async (tx) => {
          const updatedMember = await tx.departmentMember.update({
            where: {
              memberId_departmentId: { memberId, departmentId },
              deletedAt: null,
            },
            data,
          });

          let workerStatusChanged: 'deactivated' | 'reactivated' | null = null;

          if (statusChanging) {
            const worker = await tx.worker.findUnique({ where: { memberId } });

            if (worker && worker.departmentId === departmentId) {
              if (dto.status !== 'ACTIVE' && worker.isActive) {
                await tx.worker.update({
                  where: { memberId },
                  data: { isActive: false },
                });
                await tx.member.update({
                  where: { id: memberId },
                  data: { isWorker: false },
                });
                workerStatusChanged = 'deactivated';
              } else if (dto.status === 'ACTIVE' && !worker.isActive) {
                await tx.worker.update({
                  where: { memberId },
                  data: { isActive: true, deletedAt: null },
                });
                await tx.member.update({
                  where: { id: memberId },
                  data: { isWorker: true },
                });
                workerStatusChanged = 'reactivated';
              }
            }
          }

          return { updatedMember, workerStatusChanged };
        });

      await this.auditLogService.createLog(
        { id: updaterId },
        {
          action: AuditAction.UPDATE_DEPARTMENT_MEMBER,
          entity: 'DepartmentMember',
          entityId: updatedMember.id,
          description: `Updated assignment parameters for member ${memberId} in department ${existingMember.department.name}.`,
          oldValues: existingMember,
          newValues: updatedMember,
        },
      );

      if (workerStatusChanged) {
        await this.auditLogService.createLog(
          { id: updaterId },
          {
            action: AuditAction.UPDATE_WORKER,
            entity: 'Worker',
            entityId: memberId,
            description: `Worker record ${workerStatusChanged} automatically following department status change to ${dto.status}.`,
          },
        );
      }

      if (dto.role || dto.status) {
        const changes: string[] = [];
        if (dto.role) changes.push(`role changed to ${dto.role}`);
        if (dto.status) changes.push(`status changed to ${dto.status}`);

        await this.notificationService.notifyMember(memberId, {
          title: 'Department Assignment Update',
          message: `Your assignment in ${existingMember.department.name} was updated: ${changes.join(', ')}.`,
          type: NotificationType.SYSTEM,
        });
      }

      return updatedMember;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          'Active roster record for this member and department combination not found.',
        );
      }

      this.logger.error(
        `Error updating roster assignment details for department: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Roster management update failed.',
      );
    }
  }

  async removeMember(
    departmentId: string,
    memberId: string,
    removerId: string,
  ): Promise<{ message: string }> {
    const existingMember = await this.prisma.departmentMember.findUnique({
      where: { memberId_departmentId: { memberId, departmentId } },
      include: { department: true },
    });

    if (!existingMember || existingMember.deletedAt) {
      throw new NotFoundException(
        'Active roster record for this member and department combination not found.',
      );
    }

    try {
      const removed = await this.prisma.departmentMember.update({
        where: { memberId_departmentId: { memberId, departmentId } },
        data: {
          deletedAt: new Date(),
          leftAt: new Date(),
          updatedById: removerId,
        },
      });

      await this.auditLogService.createLog(
        { id: removerId },
        {
          action: AuditAction.REMOVE_DEPARTMENT_MEMBER,
          entity: 'DepartmentMember',
          entityId: removed.id,
          description: `Member ${memberId} removed from department ${existingMember.department.name}.`,
          oldValues: existingMember,
          newValues: removed,
        },
      );

      await this.notificationService.notifyMember(memberId, {
        title: 'Department Assignment Ended',
        message: `You have been removed from the ${existingMember.department.name} department.`,
        type: NotificationType.SYSTEM,
      });

      return { message: 'Member removed from department roster.' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          'Active roster record for this member and department combination not found.',
        );
      }

      this.logger.error(
        `Failed to remove member ${memberId} from department ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to remove member from department roster.',
      );
    }
  }
  async searchQuestions(q?: string, excludeDepartmentId?: string) {
    const term = q?.trim();
    return this.prisma.performanceQuestion.findMany({
      where: {
        ...(term ? { text: { contains: term, mode: 'insensitive' } } : {}),
        ...(excludeDepartmentId
          ? { metrics: { none: { departmentId: excludeDepartmentId } } }
          : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { text: 'asc' }],
      take: 20,
      select: { id: true, text: true, usageCount: true },
    });
  }
  async getDepartmentMetrics(departmentId: string, period?: string) {
    const activePeriod = period || '2026-Q3';
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
      include: {
        metrics: {
          orderBy: { createdAt: 'asc' },
          include: {
            question: true,
            entries: { where: { period: activePeriod } },
          },
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found.');

    return {
      weightingMode: department.weightingMode,
      period: activePeriod,
      metrics: department.metrics.map((m) => ({
        id: m.id,
        questionId: m.questionId,
        text: m.question.text,
        weight: m.weight,
        rating: m.entries[0]?.rating ?? null,
      })),
    };
  }
  async setDepartmentMetrics(
    departmentId: string,
    dto: SetDepartmentMetricsDto,
    adminId: string,
  ) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
    });
    if (!department) throw new NotFoundException('Department not found.');

    const { weightingMode, metrics } = dto;

    for (const m of metrics) {
      if (!!m.questionId === !!m.questionText?.trim()) {
        throw new BadRequestException(
          'Each item needs exactly one of questionId or questionText.',
        );
      }
    }
    if (weightingMode === 'CUSTOM') {
      if (metrics.some((m) => m.weight == null)) {
        throw new BadRequestException(
          'Every question needs a weight in CUSTOM mode.',
        );
      }
      const total = metrics.reduce((s, m) => s + (m.weight ?? 0), 0);
      if (total !== 100) {
        throw new BadRequestException(
          `Weights must total 100%. Provided total: ${total}%.`,
        );
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Resolve each item to a question id (reuse or create).
        const resolved: { questionId: string; weight: number }[] = [];
        const seen = new Set<string>();

        for (const m of metrics) {
          let questionId = m.questionId;
          if (questionId) {
            const exists = await tx.performanceQuestion.findUnique({
              where: { id: questionId },
            });
            if (!exists)
              throw new NotFoundException(
                'A selected question no longer exists.',
              );
          } else {
            const text = m.questionText!.trim().replace(/\s+/g, ' ');
            const existing = await tx.performanceQuestion.findFirst({
              where: { text: { equals: text, mode: 'insensitive' } },
            });
            questionId = existing
              ? existing.id
              : (
                  await tx.performanceQuestion.create({
                    data: { text, createdById: adminId },
                  })
                ).id;
          }
          if (seen.has(questionId)) {
            throw new BadRequestException('The same question was added twice.');
          }
          seen.add(questionId);
          resolved.push({
            questionId,
            weight: weightingMode === 'CUSTOM' ? m.weight! : 0,
          });
        }

        // 2. Diff against current metrics so past ratings on kept questions survive.
        const current = await tx.departmentMetric.findMany({
          where: { departmentId },
        });
        const currentIds = new Set(current.map((c) => c.questionId));
        const removed = current.filter((c) => !seen.has(c.questionId));

        if (removed.length) {
          await tx.departmentMetric.deleteMany({
            where: { id: { in: removed.map((r) => r.id) } },
          });
          await tx.performanceQuestion.updateMany({
            where: {
              id: { in: removed.map((r) => r.questionId) },
              usageCount: { gt: 0 },
            },
            data: { usageCount: { decrement: 1 } },
          });
        }

        for (const r of resolved) {
          if (currentIds.has(r.questionId)) {
            await tx.departmentMetric.update({
              where: {
                departmentId_questionId: {
                  departmentId,
                  questionId: r.questionId,
                },
              },
              data: { weight: r.weight },
            });
          } else {
            await tx.departmentMetric.create({
              data: {
                departmentId,
                questionId: r.questionId,
                weight: r.weight,
              },
            });
            await tx.performanceQuestion.update({
              where: { id: r.questionId },
              data: { usageCount: { increment: 1 } },
            });
          }
        }

        await tx.department.update({
          where: { id: departmentId },
          data: { weightingMode },
        });

        return tx.departmentMetric.findMany({
          where: { departmentId },
          include: { question: true },
          orderBy: { createdAt: 'asc' },
        });
      });

      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.UPDATE_DEPARTMENT,
          entity: 'DepartmentMetric',
          entityId: departmentId,
          description: `Super Admin configured ${metrics.length} performance questions (${weightingMode} weighting) for department "${department.name}".`,
          newValues: result,
        },
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Failed setting metrics for department ID: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to set department evaluation metrics.',
      );
    }
  }

  async recordMetricEntries(
    departmentId: string,
    entries: RecordMetricEntryDto[],
    userId: string,
  ) {
    const valid = await this.prisma.departmentMetric.findMany({
      where: { departmentId, id: { in: entries.map((e) => e.metricId) } },
      select: { id: true },
    });
    if (valid.length !== new Set(entries.map((e) => e.metricId)).size) {
      throw new BadRequestException(
        'One or more questions do not belong to this department.',
      );
    }

    try {
      const recorded = await this.prisma.$transaction(
        entries.map((entry) =>
          this.prisma.departmentMetricEntry.upsert({
            where: {
              departmentId_metricId_period: {
                departmentId,
                metricId: entry.metricId,
                period: entry.period,
              },
            },
            update: { rating: entry.rating },
            create: {
              departmentId,
              metricId: entry.metricId,
              period: entry.period,
              rating: entry.rating,
            },
          }),
        ),
      );

      await this.auditLogService.createLog(
        { id: userId },
        {
          action: AuditAction.UPDATE_DEPARTMENT,
          entity: 'DepartmentMetricEntry',
          entityId: departmentId,
          description: `Recorded ${entries.length} performance ratings for department ID ${departmentId}.`,
          newValues: recorded,
        },
      );
      return recorded;
    } catch (error) {
      this.logger.error(
        `Failed recording metric entries for department ID: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to record metric entries.',
      );
    }
  }

  async getPerformance(period?: string): Promise<DepartmentPerformanceDto[]> {
  const activePeriod = period || '2026-Q3';

  const departments = await this.prisma.department.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      leader: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      members: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      },
      workers: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          isActive: true,
        },
      },
      trainees: {
        where: {
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
        },
      },
      metrics: {
        include: {
          question: true,
          entries: {
            where: {
              period: activePeriod,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return departments.map((department) => {
    const totalMembers = department.members.length;

    const activeMembers = department.members.filter(
      (member) => member.status === 'ACTIVE',
    ).length;

    const inactiveMembers = department.members.filter(
      (member) => member.status !== 'ACTIVE',
    ).length;

    const workers = department.workers.filter(
      (worker) => worker.isActive,
    ).length;

    const trainees = department.trainees.length;

    let completionRate = 0;
    let breakdown: DepartmentPerformanceDto['breakdown'];

    const metrics = department.metrics ?? [];
    const anyRated = metrics.some((m) => m.entries[0]);

    if (metrics.length > 0 && anyRated) {
      const custom = department.weightingMode === 'CUSTOM';
      const unit = (m: (typeof metrics)[number]) => (custom ? m.weight : 1);
      const totalWeight = metrics.reduce((s, m) => s + unit(m), 0);
      const score = metrics.reduce((s, m) => {
        const rating = m.entries[0]?.rating ?? 0; // unrated counts as 0
        return s + (rating / 10) * unit(m);
      }, 0);

      completionRate = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
      breakdown = metrics.map((m) => ({
        metricId: m.id,
        question: m.question.text,
        weight: custom ? m.weight : Math.round((100 / metrics.length) * 10) / 10,
        rating: m.entries[0]?.rating ?? null,
      }));
    } else {
      const workerScore =
        activeMembers === 0
          ? 0
          : Math.min((workers / activeMembers) * 70, 70);

      const trainingScore =
        activeMembers === 0
          ? 0
          : Math.min((trainees / activeMembers) * 30, 30);

      completionRate = Math.round(workerScore + trainingScore);
    }

    return {
      id: department.id,
      name: department.name,
      leader: department.leader
        ? `${department.leader.firstName} ${department.leader.lastName}`
        : null,
      totalMembers,
      activeMembers,
      inactiveMembers,
      workers,
      trainees,
      completionRate: Math.min(completionRate, 100),
      breakdown,
    };
  });
}

  async getDepartmentMembers(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    return this.prisma.departmentMember.findMany({
      where: {
        departmentId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        member: { lastName: 'asc' },
      },
    });
  }

  /**
   * Runs once at backend boot. Backfills any DepartmentMember rows that
   * predate the auto-worker-upsert logic already inline in addMember /
   * updateMemberAssignment (those stay unchanged — new roster changes are
   * already self-syncing). Never blocks app boot on failure.
   */
  async onModuleInit() {
    try {
      const result = await this.backfillWorkersFromRoster();
      if (result.created > 0) {
        this.logger.log(`Startup worker sync: ${result.message}`);
      }
    } catch (error) {
      this.logger.error(
        'Startup worker backfill failed — app will continue booting.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Backfills Worker records for any ACTIVE DepartmentMember missing one.
   * performingAdminId is optional — omitted when called automatically from
   * onModuleInit (no real user triggered it), provided when called from the
   * manual controller route by an authenticated Super Admin.
   */
  async backfillWorkersFromRoster(performingAdminId?: string) {
    const activeMembers = await this.prisma.departmentMember.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      include: { member: { include: { worker: true } } },
    });

    const toBackfill = activeMembers.filter(
      (dm) => !dm.member.worker || dm.member.worker.deletedAt !== null,
    );

    if (toBackfill.length === 0) {
      return { message: 'No members needed backfilling.', created: 0 };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      return Promise.all(
        toBackfill.map(async (dm) => {
          const worker = await tx.worker.upsert({
            where: { memberId: dm.memberId },
            update: {
              departmentId: dm.departmentId,
              isActive: true,
              deletedAt: null,
            },
            create: {
              memberId: dm.memberId,
              departmentId: dm.departmentId,
              isActive: true,
            },
          });
          await tx.member.update({
            where: { id: dm.memberId },
            data: { isWorker: true },
          });
          return worker;
        }),
      );
    });

    await this.auditLogService.createLog(
      performingAdminId ? { id: performingAdminId } : {},
      {
        action: AuditAction.CREATE_WORKER,
        entity: 'Worker',
        entityId: 'STARTUP_SYNC',
        description: `Backfilled ${created.length} Worker record(s) from existing active department rosters.`,
        metadata: {
          count: created.length,
          memberIds: toBackfill.map((dm) => dm.memberId),
        },
      },
    );

    return {
      message: `Backfilled ${created.length} worker record(s).`,
      created: created.length,
    };
  }

  /**
   * Read-only: the departments the currently authenticated MEMBER actually
   * belongs to, with their own role in each and basic leader info. Not the
   * admin roster view — no management data, no other members' details.
   */
  async findMyDepartments(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!member) return [];

    const memberships = await this.prisma.departmentMember.findMany({
      where: { memberId: member.id, status: 'ACTIVE', deletedAt: null },
      include: {
        department: {
          include: {
            leader: {
              select: { firstName: true, lastName: true, email: true },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { department: { name: 'asc' } },
    });

    return memberships.map((m) => ({
      id: m.department.id,
      name: m.department.name,
      slug: m.department.slug,
      description: m.department.description,
      myRole: m.role,
      joinedAt: m.joinedAt,
      leaderName: m.department.leader
        ? `${m.department.leader.firstName} ${m.department.leader.lastName}`
        : null,
      leaderEmail: m.department.leader?.email ?? null,
      memberCount: m.department._count.members,
    }));
  }
  /**
   * Soft-deletes a department and cascades to soft-delete its active
   * roster (DepartmentMember rows) and deactivate any linked Worker
   * records, mirroring MinistriesService.remove's cascade pattern.
   */
  async remove(id: string, removerId: string): Promise<{ message: string }> {
    const department = await this.prisma.department.findUnique({
      where: { id, deletedAt: null },
      include: {
        members: { where: { deletedAt: null, status: 'ACTIVE' } },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.department.update({
          where: { id },
          data: { deletedAt: new Date(), updatedById: removerId },
        });

        await tx.departmentMember.updateMany({
          where: { departmentId: id, deletedAt: null },
          data: {
            deletedAt: new Date(),
            leftAt: new Date(),
            updatedById: removerId,
          },
        });

        // Deactivate workers whose home department is being removed —
        // does not delete Worker rows, just marks them inactive so
        // performance/roster views stop counting them here.
        await tx.worker.updateMany({
          where: { departmentId: id, deletedAt: null },
          data: { isActive: false },
        });
      });

      await this.auditLogService.createLog(
        { id: removerId },
        {
          action: AuditAction.DELETE_DEPARTMENT,
          entity: 'Department',
          entityId: id,
          description: `Department "${department.name}" was deleted, along with ${department.members.length} active roster record(s).`,
          oldValues: department,
        },
      );

      if (department.leaderId) {
        await this.notificationService.notifyMember(department.leaderId, {
          title: 'Department Removed',
          message: `The department "${department.name}", which you led, has been removed.`,
          type: NotificationType.SYSTEM,
        });
      }

      return { message: 'Department deleted successfully.' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Department not found.');
      }
      this.logger.error(
        `Failed to delete department ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to delete department.');
    }
  }
}
