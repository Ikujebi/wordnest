import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Ministry, WorkerAttendance, Prisma } from '../../../app/generated/prisma/client';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { LogWorkerAttendanceDto } from './dto/log-worker-attendance.dto';

@Injectable()
export class MinistriesService {
  private readonly logger = new Logger(MinistriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a specialized service group or operational ministry wing inside the system.
   */
  async createMinistry(dto: CreateMinistryDto): Promise<Ministry> {
    try {
      return await this.prisma.ministry.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          leaderId: dto.leaderId || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint failed (e.g., duplicated ministry name or leader already assigned elsewhere)
        if (error.code === 'P2002') {
          throw new ConflictException('A ministry with this name already exists, or the selected leader is already managing another ministry.');
        }
        // P2003: Foreign key reference failure
        if (error.code === 'P2003') {
          throw new NotFoundException('The targeted Worker record assigned as leader was not found.');
        }
      }
      this.logger.error('Failed to establish operational ministry group architecture', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not create ministry department.');
    }
  }

  /**
   * Tracks or updates a worker's roster duty compliance log atomically via a structural upsert.
   */
  async trackWorkerDuty(dto: LogWorkerAttendanceDto): Promise<WorkerAttendance> {
    // Standardize midnight index timestamp string bounds to match unique compound schema indices cleanly
    const targetDate = new Date(dto.date);
    targetDate.setUTCHours(0, 0, 0, 0);

    try {
      return await this.prisma.workerAttendance.upsert({
        where: {
          workerId_date: {
            workerId: dto.workerId,
            date: targetDate,
          },
        },
        update: {
          status: dto.status,
        },
        create: {
          workerId: dto.workerId,
          date: targetDate,
          status: dto.status,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('The designated Worker identity reference does not exist inside the active roster pool.');
      }
      this.logger.error(`Duty log operational crash recorded for worker: ${dto.workerId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to process worker service attendance entry.');
    }
  }
}