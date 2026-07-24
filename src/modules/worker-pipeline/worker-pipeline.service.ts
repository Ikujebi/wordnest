import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkerInTraining, Prisma, NotificationType } from '@prisma/client';
import { ApplyTrainingDto } from './dto/apply-training.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';

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
  async initializeOnboarding(dto: ApplyTrainingDto): Promise<WorkerInTraining> {
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
        {},
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
          {},
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
          {},
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
            {},
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
}