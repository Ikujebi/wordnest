import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,BadRequestException,ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkerInTraining, Prisma, NotificationType } from '@prisma/client';
import { ApplyTrainingDto } from './dto/apply-training.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { PipelineQueryDto } from './dto/pipeline-query.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';
import { AddPipelineNoteDto } from './dto/add-pipeline-note.dto';

@Injectable()
export class WorkerPipelineService {
  private readonly logger = new Logger(WorkerPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Initializes an onboarding pipeline tracking record for a prospective worker.
   */
  async initializeOnboarding(
    dto: ApplyTrainingDto,
    adminId: string,
  ): Promise<WorkerInTraining> {
    try {
      const pipeline = await this.prisma.workerInTraining.create({
        data: {
          memberId: dto.memberId,
          departmentId: dto.departmentId,
          mentorId: dto.mentorId || null,
          mentorWorkerId: dto.mentorWorkerId || null,
          notes: dto.notes || null,
          stage: 'APPLIED',
          isActive: true,
        },
      });

      // 1. Notify Admins/Super Admins
      await this.notificationService.notifyAdmins({
        title: 'New Worker Application',
        message: 'A new member has applied for worker training.',
        type: NotificationType.INFO,
      });

      // 2. Audit Log
      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.CREATE_WORKER_PIPELINE,
          entity: 'WorkerInTraining',
          entityId: pipeline.id,
          description: 'Worker onboarding initialized',
          newValues: pipeline,
        },
      );

      // Log mentor assignment if specified
      if (dto.mentorId || dto.mentorWorkerId) {
        await this.auditLogService.createLog(
          { id: adminId },
          {
            action: AuditAction.ASSIGN_WORKER_MENTOR,
            entity: 'WorkerInTraining',
            entityId: pipeline.id,
            description: 'Mentor assigned during pipeline initialization',
            newValues: { mentorId: dto.mentorId, mentorWorkerId: dto.mentorWorkerId },
          },
        );
      }

      return pipeline;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(
          'One or more relational entity IDs (Member, Department, or Mentors) do not exist.',
        );
      }
      this.logger.error(
        'Failed to initialize worker training pipeline record',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Database failure mapping onboarding workflow.',
      );
    }
  }

  /**
   * Mutates the onboarding track stage. If marked 'ACTIVE_WORKER', it automatically promotes
   * the record transactionally into the operational global Worker directory pool.
   */
  async advancePipelineStage(
    id: string,
    dto: UpdatePipelineStageDto,
    adminId: string,
  ): Promise<WorkerInTraining> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pipelineRecord = await tx.workerInTraining.findUnique({
          where: { id, deletedAt: null },
        });

        if (!pipelineRecord) {
          throw new NotFoundException('Active pipeline tracking record not found.');
        }

        const before = { ...pipelineRecord };

        // Update pipeline stage details
        const updatedRecord = await tx.workerInTraining.update({
          where: { id },
          data: {
            stage: dto.stage,
            leadershipClassId: dto.leadershipClassId || undefined,
            notes: dto.notes
              ? `${pipelineRecord.notes || ''}\n[Update]: ${dto.notes}`
              : undefined,
            ...(dto.stage === 'ACTIVE_WORKER'
              ? { completedAt: new Date(), isActive: false }
              : {}),
          },
        });

        // 1. Notify member of stage change
        await this.notificationService.notifyMember(pipelineRecord.memberId, {
          title: 'Worker Training Update',
          message: `Your training status has been updated to ${dto.stage}.`,
          type: NotificationType.INFO,
        });

        // 2. Audit log for stage change
        await this.auditLogService.createLog(
          { id: adminId },
          {
            action: AuditAction.UPDATE_WORKER_PIPELINE_STAGE,
            entity: 'WorkerInTraining',
            entityId: updatedRecord.id,
            description: `Pipeline advanced to ${dto.stage}`,
            oldValues: before,
            newValues: updatedRecord,
          },
        );

        // 3. Handle Promotion to Active Worker
        if (dto.stage === 'ACTIVE_WORKER') {
          const worker = await tx.worker.upsert({
            where: { memberId: pipelineRecord.memberId },
            update: {
              departmentId: pipelineRecord.departmentId,
              isActive: true,
              deletedAt: null,
            },
            create: {
              memberId: pipelineRecord.memberId,
              departmentId: pipelineRecord.departmentId,
              isActive: true,
              position: 'Trainee Graduate',
            },
          });

          await tx.member.update({
            where: { id: pipelineRecord.memberId },
            data: { isWorker: true },
          });

          // Send Promotion Notifications
          await this.notificationService.notifyMember(pipelineRecord.memberId, {
            title: 'Congratulations!',
            message:
              'Congratulations! You have successfully completed your worker training and have been promoted to an active worker.',
            type: NotificationType.SUCCESS,
          });

          await this.notificationService.notifyAdmins({
            title: 'New Active Worker',
            message: 'A worker trainee has been promoted to Active Worker.',
            type: NotificationType.SUCCESS,
          });

          // Promotion Audit Log
          await this.auditLogService.createLog(
            { id: adminId },
            {
              action: AuditAction.PROMOTE_TO_WORKER,
              entity: 'Worker',
              entityId: worker.id,
              description: 'Worker trainee promoted to active worker',
              newValues: worker,
            },
          );
        }

        return updatedRecord;
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `Failed executing transition phase metrics on pipeline instance: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Transaction rollback executed. Roster upgrade pipeline failed.',
      );
    }
  }

  /**
   * Lists all active (non-deleted) pipeline records, optionally filtered by
   * stage or search term, grouped for Kanban-style board rendering.
   */
  async findAll(query: PipelineQueryDto) {
    const where: Prisma.WorkerInTrainingWhereInput = {
      deletedAt: null,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.search
        ? {
            member: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    return this.prisma.workerInTraining.findMany({
      where,
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
        mentor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Retrieves a single pipeline record with full relation detail.
   */
  async findOne(id: string) {
    const record = await this.prisma.workerInTraining.findUnique({
      where: { id, deletedAt: null },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
        },
        department: { select: { id: true, name: true } },
        mentor: { select: { id: true, firstName: true, lastName: true } },
        mentorWorker: { select: { id: true, position: true } },
        leadershipClass: { select: { id: true, name: true, level: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Pipeline record not found.');
    }

    return record;
  }
    /**
   * Standalone mentor assignment — doesn't touch stage, so a mentor can be
   * set or changed independently of progression.
   */
  async assignMentor(id: string, dto: AssignMentorDto, adminId: string) {
    const record = await this.prisma.workerInTraining.findUnique({
      where: { id, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException('Pipeline record not found.');
    }

    const updated = await this.prisma.workerInTraining.update({
      where: { id },
      data: {
        mentorId: dto.mentorId ?? null,
        mentorWorkerId: dto.mentorWorkerId ?? null,
      },
    });

    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: AuditAction.ASSIGN_WORKER_MENTOR,
        entity: 'WorkerInTraining',
        entityId: updated.id,
        description: 'Mentor assignment updated for pipeline record',
        oldValues: { mentorId: record.mentorId, mentorWorkerId: record.mentorWorkerId },
        newValues: { mentorId: updated.mentorId, mentorWorkerId: updated.mentorWorkerId },
      },
    );

    if (dto.mentorId) {
      await this.notificationService.notifyMember(dto.mentorId, {
        title: 'Mentorship Assignment',
        message: 'You have been assigned as a mentor for a worker-in-training candidate.',
        type: NotificationType.INFO,
      });
    }

    return this.findOne(id);
  }

  /**
   * Appends a timestamped remark to the pipeline record's notes log.
   * Concatenation happens server-side (not client-side, as the old
   * frontend hook did) so two admins adding notes around the same time
   * can't silently overwrite each other's text.
   */
  async addNote(id: string, dto: AddPipelineNoteDto, adminId: string) {
    const record = await this.prisma.workerInTraining.findUnique({
      where: { id, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException('Pipeline record not found.');
    }

    const timestamp = new Date().toLocaleDateString();
    const appendedNotes = record.notes
      ? `${record.notes}\n\n[${timestamp}]: ${dto.note}`
      : `[${timestamp}]: ${dto.note}`;

    const updated = await this.prisma.workerInTraining.update({
      where: { id },
      data: { notes: appendedNotes },
    });

    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: AuditAction.UPDATE,
        entity: 'WorkerInTraining',
        entityId: updated.id,
        description: 'Note added to pipeline record',
        newValues: { note: dto.note },
      },
    );

    return this.findOne(id);
  }
  async getOpenCohort() {
  return this.prisma.workerCohort.findFirst({ where: { isOpen: true } });
}

async openCohort(name: string, adminId: string) {
  return this.prisma.$transaction(async (tx) => {
    await tx.workerCohort.updateMany({
      where: { isOpen: true },
      data: { isOpen: false, closedAt: new Date() },
    });
    const cohort = await tx.workerCohort.create({
      data: { name, isOpen: true, openedAt: new Date(), createdById: adminId },
    });
    await this.auditLogService.createLog(
      { id: adminId },
      { action: AuditAction.CREATE_WORKER_PIPELINE, entity: 'WorkerCohort', entityId: cohort.id, description: `Opened worker cohort "${name}"` },
    );
    return cohort;
  });
}

async closeCohort(adminId: string) {
  const cohort = await this.prisma.workerCohort.findFirst({ where: { isOpen: true } });
  if (!cohort) throw new NotFoundException('No cohort is currently open.');
  const updated = await this.prisma.workerCohort.update({
    where: { id: cohort.id },
    data: { isOpen: false, closedAt: new Date() },
  });
  await this.auditLogService.createLog(
    { id: adminId },
    { action: AuditAction.UPDATE_WORKER_PIPELINE_STAGE, entity: 'WorkerCohort', entityId: cohort.id, description: `Closed worker cohort "${cohort.name}"` },
  );
  return updated;
}

/** Member self-application — distinct from admin-driven initializeOnboarding. */
async applyAsMember(memberId: string, departmentId: string, notes?: string) {
  const cohort = await this.getOpenCohort();
  if (!cohort) throw new BadRequestException('Applications are not currently open.');

  const member = await this.prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new NotFoundException('Member profile not found.');
  if (member.isWorker) throw new ConflictException('You are already a registered worker.');

  const existing = await this.prisma.workerInTraining.findFirst({
    where: { memberId, isActive: true, deletedAt: null },
  });
  if (existing) throw new ConflictException('You already have an active application in progress.');

  const pipeline = await this.prisma.workerInTraining.create({
    data: { memberId, departmentId, notes: notes || null, stage: 'APPLIED', isActive: true, cohortId: cohort.id },
  });

  await this.notificationService.notifyAdmins({
    title: 'New Worker Application',
    message: 'A new member has applied for worker training.',
    type: NotificationType.INFO,
  });

  await this.auditLogService.createLog(
    { id: memberId },
    { action: AuditAction.CREATE_WORKER_PIPELINE, entity: 'WorkerInTraining', entityId: pipeline.id, description: 'Member self-applied for worker training', newValues: pipeline },
  );

  return pipeline;
}

/** Random mentor assignment, drawn from active workers, optionally scoped to the trainee's department. */
async assignRandomMentor(id: string, adminId: string) {
  const record = await this.prisma.workerInTraining.findUnique({ where: { id, deletedAt: null } });
  if (!record) throw new NotFoundException('Pipeline record not found.');

  const candidates = await this.prisma.worker.findMany({
    where: { isActive: true, deletedAt: null, departmentId: record.departmentId },
  });
  if (candidates.length === 0) {
    throw new NotFoundException('No active workers available in this department to assign as a mentor.');
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  const updated = await this.prisma.workerInTraining.update({
    where: { id },
    data: { mentorWorkerId: chosen.id, mentorId: null },
  });

  await this.notificationService.notifyMember(chosen.memberId, {
    title: 'Mentorship Assignment',
    message: 'You have been randomly assigned as a mentor for a worker-in-training candidate.',
    type: NotificationType.INFO,
  });

  await this.auditLogService.createLog(
    { id: adminId },
    { action: AuditAction.ASSIGN_WORKER_MENTOR, entity: 'WorkerInTraining', entityId: id, description: 'Mentor randomly assigned', newValues: { mentorWorkerId: chosen.id } },
  );

  return this.findOne(id);
}
}