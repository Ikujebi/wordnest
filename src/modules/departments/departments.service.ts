// src/departments/departments.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Department, DepartmentMember, Prisma, NotificationType } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
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
}