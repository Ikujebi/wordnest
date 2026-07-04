import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkerInTraining, Worker, Prisma } from '@prisma/client';
import { ApplyTrainingDto } from './dto/apply-training.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';

@Injectable()
export class WorkerPipelineService {
  private readonly logger = new Logger(WorkerPipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes an onboarding pipeline tracking record for a prospective worker.
   */
  async initializeOnboarding(dto: ApplyTrainingDto): Promise<WorkerInTraining> {
    try {
      return await this.prisma.workerInTraining.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('One or more relational entity IDs (Member, Department, or Mentors) do not exist.');
      }
      this.logger.error('Failed to initialize worker training pipeline record', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Database failure mapping onboarding workflow.');
    }
  }

  /**
   * Mutates the onboarding track stage. If marked 'ACTIVE_WORKER', it automatically promotes
   * the record transactionally into the operational global Worker directory pool.
   */
  async advancePipelineStage(id: string, dto: UpdatePipelineStageDto): Promise<WorkerInTraining> {
    try {
      // Use sequential atomic execution context block
      return await this.prisma.$transaction(async (tx) => {
        const pipelineRecord = await tx.workerInTraining.findUnique({
          where: { id, deletedAt: null },
        });

        if (!pipelineRecord) {
          throw new NotFoundException('Active pipeline tracking record not found.');
        }

        // Complete the application update metrics step
        const updatedRecord = await tx.workerInTraining.update({
          where: { id },
          data: {
            stage: dto.stage,
            leadershipClassId: dto.leadershipClassId || undefined,
            notes: dto.notes ? `${pipelineRecord.notes || ''}\n[Update]: ${dto.notes}` : undefined,
            ...(dto.stage === 'ACTIVE_WORKER' ? { completedAt: new Date(), isActive: false } : {}),
          },
        });

        // Trigger safe promotion sequence down to the core operational structural directory
        if (dto.stage === 'ACTIVE_WORKER') {
          await tx.worker.upsert({
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

          // Mark structural membership flag context updates
          await tx.member.update({
            where: { id: pipelineRecord.memberId },
            data: { isWorker: true },
          });
        }

        return updatedRecord;
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed executing transition phase metrics on pipeline instance: ${id}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Transaction rollback executed. Roster upgrade pipeline failed.');
    }
  }
}