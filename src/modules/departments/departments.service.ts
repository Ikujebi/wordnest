// src/departments/departments.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Department, DepartmentMember, DepartmentRole, Prisma, NotificationType } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
import { AssignDepartmentLeaderDto } from './dto/assign-department-leader.dto';
import { DepartmentPerformanceDto } from './dto/department-performance.dto';
import { CreateDepartmentMetricDto } from './dto/create-department-metric.dto';
import { RecordMetricEntryDto } from './dto/record-metric-entry.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import slugify from 'slugify';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new operational department alongside its unique search slug.
   */
  async create(dto: CreateDepartmentDto, creatorId: string): Promise<Department> {
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

      // 1. Audit Log
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

      // 2. Real-Time Notification -> Super Admins
      await this.notificationService.notifySuperAdmins({
        title: 'New Department Created',
        message: `Department "${department.name}" has been created.`,
        type: NotificationType.SYSTEM,
      });

      // 3. Optional: Notify assigned leader if designated on creation
      if (dto.leaderId) {
        await this.notificationService.notifyMember(dto.leaderId, {
          title: 'Department Leadership Assignment',
          message: `You have been designated as the leader of ${department.name}.`,
          type: NotificationType.SYSTEM,
        });
      }

      return department;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this name or slug already exists.');
      }
      this.logger.error('Failed to create department', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An unexpected database error occurred.');
    }
  }
/**
   * Lists all active departments.
   */
  async findAll(): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        leader: true,
        _count: { select: { members: true } },
      },
    });
  }

  /**
   * Retrieves a single department by ID, with leader and member count.
   */
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
  /**
   * Assigns an existing active department member as the department leader.
   */
  async assignLeader(
    departmentId: string,
    dto: AssignDepartmentLeaderDto,
    updaterId: string,
  ): Promise<Department> {
    const { leaderId } = dto;

    // 1. Verify department exists and is active
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
      include: { leader: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    // 2. Ensure the candidate member exists and belongs to this department
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

    if (!candidateMember || candidateMember.deletedAt || candidateMember.status !== 'ACTIVE') {
      throw new BadRequestException(
        'The designated leader must be an active member of this department.',
      );
    }

    try {
      // 3. Execute updates in a transaction: update Department leaderId and update member roles
      const updatedDepartment = await this.prisma.$transaction(async (tx) => {
        // Demote previous leader's role in DepartmentMember if applicable
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

        // Elevate new leader's department role to LEADER
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

        // Set leaderId on Department record
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

      // 4. Audit Log
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

      // 5. Real-Time Notification -> Notify new leader
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
      throw new InternalServerErrorException('Failed to update department leader assignment.');
    }
  }

  /**
   * Adds a physical Member profile to a specific Department group.
   */
  async addMember(
    departmentId: string,
    dto: AddDepartmentMemberDto,
    creatorId: string,
  ): Promise<DepartmentMember> {
    try {
      const departmentMember = await this.prisma.departmentMember.create({
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

      // 1. Audit Log
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

      // 2. Real-Time Notification -> Notify the added member directly
      await this.notificationService.notifyMember(dto.memberId, {
        title: 'Department Assignment',
        message: `You have been added to the ${departmentMember.department.name} department as ${dto.role}.`,
        type: NotificationType.ANNOUNCEMENT,
      });

      return departmentMember;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This member is already registered in this department.');
      }
      this.logger.error(
        `Failed to assign member to department ID: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('An unexpected error occurred assigning the member roster.');
    }
  }

  /**
   * Modifies role parameters or soft-removes a member from the operational team roster.
   */
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
      // Fetch current state for Audit Log comparisons
      const existingMember = await this.prisma.departmentMember.findUnique({
        where: { memberId_departmentId: { memberId, departmentId } },
        include: { department: true },
      });

      if (!existingMember || existingMember.deletedAt) {
        throw new NotFoundException('Active roster record for this member and department combination not found.');
      }

      const updatedMember = await this.prisma.departmentMember.update({
        where: {
          memberId_departmentId: { memberId, departmentId },
          deletedAt: null,
        },
        data,
      });

      // 1. Audit Log
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

      // 2. Real-Time Notification -> Alert the member if their role or status changed
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

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Active roster record for this member and department combination not found.');
      }

      this.logger.error(
        `Error updating roster assignment details for department: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Roster management update failed.');
    }
  }

  /**
   * Configures custom evaluation metrics for a specific department (Super-Admin only).
   * Validates that total weights equal exactly 100%.
   */
  async setDepartmentMetrics(
    departmentId: string,
    metrics: CreateDepartmentMetricDto[],
    adminId: string,
  ) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException(
        `Total weight of department metrics must equal 100%. Provided total: ${totalWeight}%.`,
      );
    }

    try {
      const createdMetrics = await this.prisma.$transaction(async (tx) => {
        await tx.departmentMetric.deleteMany({ where: { departmentId } });

        return Promise.all(
          metrics.map((m) =>
            tx.departmentMetric.create({
              data: {
                title: m.title,
                weight: m.weight,
                targetValue: m.targetValue,
                departmentId,
              },
            }),
          ),
        );
      });

      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.UPDATE_DEPARTMENT,
          entity: 'DepartmentMetric',
          entityId: departmentId,
          description: `Super Admin configured ${metrics.length} dynamic metrics for department "${department.name}".`,
          newValues: createdMetrics,
        },
      );

      return createdMetrics;
    } catch (error) {
      this.logger.error(
        `Failed setting metrics for department ID: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to set department evaluation metrics.');
    }
  }

  /**
   * Logs or updates achieved metric performance entries for a department for a specified evaluation period.
   */
  async recordMetricEntries(
    departmentId: string,
    entries: RecordMetricEntryDto[],
    userId: string,
  ) {
    try {
      const recorded = await this.prisma.$transaction(async (tx) => {
        return Promise.all(
          entries.map((entry) =>
            tx.departmentMetricEntry.upsert({
              where: {
                departmentId_metricId_period: {
                  departmentId,
                  metricId: entry.metricId,
                  period: entry.period,
                },
              },
              update: {
                achievedValue: entry.achievedValue,
              },
              create: {
                departmentId,
                metricId: entry.metricId,
                period: entry.period,
                achievedValue: entry.achievedValue,
              },
            }),
          ),
        );
      });

      await this.auditLogService.createLog(
        { id: userId },
        {
          action: AuditAction.UPDATE_DEPARTMENT,
          entity: 'DepartmentMetricEntry',
          entityId: departmentId,
          description: `Recorded ${entries.length} performance metric entries for department ID ${departmentId}.`,
          newValues: recorded,
        },
      );

      return recorded;
    } catch (error) {
      this.logger.error(
        `Failed recording metric entries for department ID: ${departmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to record metric entries.');
    }
  }

  /**
   * Calculates performance percentage across active departments.
   * Fallbacks dynamically to custom metrics if defined, or uses the standard formula (70% Workers + 30% Trainees).
   */
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

      // Check if custom Super-Admin metrics are defined
      if (department.metrics && department.metrics.length > 0) {
        let dynamicScore = 0;

        department.metrics.forEach((metric) => {
          const entry = metric.entries[0];
          const achieved = entry ? entry.achievedValue : 0;
          const performanceRatio = Math.min(achieved / metric.targetValue, 1);
          dynamicScore += performanceRatio * metric.weight;
        });

        completionRate = Math.round(dynamicScore);
      } else {
        // Fallback: Default Operational Formula (70% Workers + 30% Trainees)
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
      };
    });
  }
  /**
 * Lists active roster members of a department (for leader-assignment dropdowns, etc).
 */
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
}