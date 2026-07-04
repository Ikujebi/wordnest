import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Event, Attendance, Prisma } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Schedules a new event in the system.
   */
  async createEvent(dto: CreateEventDto, creatorId: string): Promise<Event> {
    try {
      return await this.prisma.event.create({
        data: {
          ...dto,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          createdById: creatorId,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create event', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An unexpected database error occurred while creating the event.');
    }
  }

  /**
   * Retrieves all active and published events, sorted by date.
   */
  async findAllActive(): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Records or updates a member's attendance status for an event atomically.
   */
  async recordAttendance(eventId: string, dto: RecordAttendanceDto): Promise<Attendance> {
    try {
      // Upsert handles both new registrations and status modifications (e.g., ABSENT -> PRESENT) cleanly
      return await this.prisma.attendance.upsert({
        where: {
          memberId_eventId: {
            memberId: dto.memberId,
            eventId,
          },
        },
        update: {
          status: dto.status,
        },
        create: {
          eventId,
          memberId: dto.memberId,
          status: dto.status,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003: Foreign key constraint failure (e.g., eventId or memberId does not exist)
        if (error.code === 'P2003') {
          throw new NotFoundException('The specified Event or Member record could not be found.');
        }
      }
      this.logger.error(`Failed to log attendance for event ID: ${eventId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An error occurred while tracking attendance.');
    }
  }

  /**
   * Fetches an event profile alongside its detailed member attendance sheet.
   */
  async getEventRoster(eventId: string) {
    const eventData = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        attendances: {
          include: {
            member: true,
          },
        },
      },
    });

    if (!eventData) {
      throw new NotFoundException('Event not found.');
    }

    return eventData;
  }
}