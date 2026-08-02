import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Worker, Prisma, NotificationType } from '@prisma/client';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { WorkerQueryDto } from './dto/worker-query.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Manually creates a worker and sets the Member's isWorker flag to true.
   */
  async create(dto: CreateWorkerDto, adminId?: string): Promise<Worker> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingWorker = await tx.worker.findUnique({
          where: { memberId: dto.memberId },
        });

        if (existingWorker) {
          if (existingWorker.deletedAt) {
            // Restore previously soft-deleted worker
            return await tx.worker.update({
              where: { id: existingWorker.id },
              data: {
                ...dto,
                deletedAt: null,
                isActive: true,
              },
            });
          }
          throw new ConflictException('This member is already registered as a worker.');
        }

        const worker = await tx.worker.create({
          data: {
            memberId: dto.memberId,
            departmentId: dto.departmentId || null,
            ministryId: dto.ministryId || null,
            position: dto.position || null,
            isActive: dto.isActive ?? true,
          },
        });

        await tx.member.update({
          where: { id: dto.memberId },
          data: { isWorker: true },
        });

        // Notify admins
        await this.notificationService.notifyAdmins({
          title: 'New Worker Registered',
          message: `${worker.memberId} has been registered as a worker.`,
          type: NotificationType.SYSTEM,
        });

        // Audit log
        await this.auditLogService.createLog(
          adminId ? { id: adminId } : {},
          {
            action: AuditAction.CREATE_WORKER,
            entity: 'Worker',
            entityId: worker.id,
            description: 'Worker registered',
            newValues: worker,
          },
        );

        return worker;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('Referenced Member, Department, or Ministry does not exist.');
      }
      this.logger.error('Failed to create worker', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to create worker record.');
    }
  }

  /**
   * Retrieves paginated list of workers with filtering capabilities.
   */
  async findAll(query: WorkerQueryDto) {
    const { page = 1, limit = 10, departmentId, ministryId, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkerWhereInput = {
      deletedAt: null,
      ...(departmentId && { departmentId }),
      ...(ministryId && { ministryId }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        member: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.worker.count({ where }),
      this.prisma.worker.findMany({
        where,
        skip,
        take: limit,
        include: {
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          department: { select: { id: true, name: true } },
          ministry: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Finds a single worker by ID with full relational context.
   */
  async findOne(id: string): Promise<Worker> {
    const worker = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      include: {
        member: true,
        department: true,
        ministry: true,
        leadsMinistry: true,
        attendances: {
          take: 10,
          orderBy: { date: 'desc' },
        },
        trainingMentees: {
          where: { deletedAt: null },
          include: { member: true },
        },
      },
    });

    if (!worker) {
      throw new NotFoundException(`Worker with ID "${id}" not found.`);
    }

    return worker;
  }

  /**
   * Updates worker assignment details.
   */
  async update(id: string, dto: UpdateWorkerDto, adminId?: string): Promise<Worker> {
    const before = await this.findOne(id);

    try {
      const worker = await this.prisma.worker.update({
        where: { id },
        data: dto,
      });

      await this.notificationService.notifyAdmins({
        title: 'Worker Updated',
        message: `Worker record has been updated.`,
        type: NotificationType.SYSTEM,
      });

      await this.auditLogService.createLog(
        adminId ? { id: adminId } : {},
        {
          action: AuditAction.UPDATE_WORKER,
          entity: 'Worker',
          entityId: worker.id,
          description: 'Worker updated',
          oldValues: before,
          newValues: worker,
        },
      );

      return worker;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('Referenced Department or Ministry does not exist.');
      }
      this.logger.error(`Failed to update worker ${id}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not update worker profile.');
    }
  }

  /**
   * Soft deletes a worker profile and updates member status if no active worker record remains.
   */
  async remove(id: string, adminId?: string): Promise<{ success: boolean }> {
    const worker = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await tx.member.update({
        where: { id: worker.memberId },
        data: { isWorker: false },
      });
    });

    await this.notificationService.notifyAdmins({
      title: 'Worker Removed',
      message: 'A worker has been removed.',
      type: NotificationType.WARNING,
    });

    await this.auditLogService.createLog(
      adminId ? { id: adminId } : {},
      {
        action: AuditAction.DELETE_WORKER,
        entity: 'Worker',
        entityId: worker.id,
        description: 'Worker removed',
        oldValues: worker,
      },
    );

    return { success: true };
  }

  /**
   * Records or updates worker attendance for a given date, notifies the member, and logs an audit record.
   */
  async recordAttendance(workerId: string, dto: RecordAttendanceDto, adminId?: string) {
    const worker = await this.findOne(workerId);
    const attendanceDate = new Date(dto.date);

    const attendance = await this.prisma.workerAttendance.upsert({
      where: {
        workerId_date: {
          workerId,
          date: attendanceDate,
        },
      },
      update: {
        status: dto.status,
      },
      create: {
        workerId,
        date: attendanceDate,
        status: dto.status,
      },
    });

    await this.notificationService.notifyMember(worker.memberId, {
      title: 'Attendance Recorded',
      message: `Your worker attendance for ${attendanceDate.toDateString()} has been recorded.`,
      type: NotificationType.INFO,
    });

    await this.auditLogService.createLog(
      adminId ? { id: adminId } : {},
      {
        action: AuditAction.RECORD_WORKER_ATTENDANCE,
        entity: 'WorkerAttendance',
        entityId: attendance.id,
        description: 'Worker attendance recorded',
        newValues: attendance,
      },
    );

    return attendance;
  }
}