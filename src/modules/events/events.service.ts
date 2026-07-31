import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Event, Attendance, Prisma, NotificationType } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Helper to fetch an active event or throw NotFoundException
   */
  private async findEventOrThrow(id: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" was not found.`);
    }

    return event;
  }

  /**
   * Schedules a new event in the system.
   */
  async createEvent(dto: CreateEventDto, creatorId: string): Promise<Event> {
    let event: Event;

    try {
      event = await this.prisma.event.create({
        data: {
          ...dto,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          createdById: creatorId,
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to create event',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'An unexpected database error occurred while creating the event.',
      );
    }

    await this.notificationService.notifyEveryone({
      title: 'New Church Event',
      message: `${event.title} has been scheduled.`,
      type: NotificationType.EVENT,
    });

    await this.auditLogService.createLog(
      { id: creatorId },
      {
        action: AuditAction.CREATE_EVENT,
        entity: 'Event',
        entityId: event.id,
        description: 'Created a new church event',
        newValues: event,
      },
    );

    return event;
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
   * Publishes an event to make it visible publicly/to members.
   */
  async publishEvent(id: string, userId?: string): Promise<Event> {
    const existing = await this.findEventOrThrow(id);

    const event = await this.prisma.event.update({
      where: { id },
      data: { isPublished: true },
    });

    await this.notificationService.notifyEveryone({
      title: 'Event Published',
      message: `${event.title} is now open.`,
      type: NotificationType.EVENT,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.PUBLISH_EVENT,
        entity: 'Event',
        entityId: event.id,
        description: `Published event: ${event.title}`,
        oldValues: existing,
        newValues: event,
      },
    );

    return event;
  }

  /**
   * Updates existing event details.
   */
  async updateEvent(
    id: string,
    dto: UpdateEventDto,
    userId?: string,
  ): Promise<Event> {
    const existing = await this.findEventOrThrow(id);

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
    });

    await this.notificationService.notifyEveryone({
      title: 'Event Updated',
      message: `${updatedEvent.title} details have changed.`,
      type: NotificationType.EVENT,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.UPDATE_EVENT,
        entity: 'Event',
        entityId: updatedEvent.id,
        description: `Updated event: ${updatedEvent.title}`,
        oldValues: existing,
        newValues: updatedEvent,
      },
    );

    return updatedEvent;
  }

  /**
   * Cancels an upcoming event.
   */
  async cancelEvent(id: string, userId?: string): Promise<Event> {
    const existing = await this.findEventOrThrow(id);

    const cancelledEvent = await this.prisma.event.update({
      where: { id },
      data: { isPublished: false },
    });

    await this.notificationService.notifyEveryone({
      title: 'Event Cancelled',
      message: `${cancelledEvent.title} has been cancelled.`,
      type: NotificationType.EVENT,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.CANCEL_EVENT,
        entity: 'Event',
        entityId: cancelledEvent.id,
        description: `Cancelled event: ${cancelledEvent.title}`,
        oldValues: existing,
        newValues: cancelledEvent,
      },
    );

    return cancelledEvent;
  }

  /**
   * Soft deletes an event from the system.
   */
  async deleteEvent(id: string, userId?: string): Promise<Event> {
    const existing = await this.findEventOrThrow(id);

    const deletedEvent = await this.prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.notificationService.notifyEveryone({
      title: 'Event Removed',
      message: `${deletedEvent.title} has been removed.`,
      type: NotificationType.EVENT,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.DELETE_EVENT,
        entity: 'Event',
        entityId: deletedEvent.id,
        description: `Soft deleted event: ${deletedEvent.title}`,
        oldValues: existing,
        newValues: deletedEvent,
      },
    );

    return deletedEvent;
  }

  /**
   * Records or updates a member's attendance status for an event atomically.
   */
  async recordAttendance(
    eventId: string,
    dto: RecordAttendanceDto,
  ): Promise<Attendance> {
    let attendance: Attendance;

    try {
      attendance = await this.prisma.attendance.upsert({
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
        if (error.code === 'P2003') {
          throw new NotFoundException(
            'The specified Event or Member record could not be found.',
          );
        }
      }
      this.logger.error(
        `Failed to log attendance for event ID: ${eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'An error occurred while tracking attendance.',
      );
    }

    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
      select: { userId: true, firstName: true, lastName: true },
    });

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });

    if (member?.userId && event) {
      await this.notificationService.create({
        userId: member.userId,
        title: 'Attendance Recorded',
        message: `Your attendance for "${event.title}" has been recorded.`,
        type: NotificationType.EVENT,
      });
    }

    await this.auditLogService.createLog(
      { id: member?.userId ?? undefined },
      {
        action: AuditAction.RECORD_EVENT_ATTENDANCE,
        entity: 'Attendance',
        entityId: attendance.id,
        description: `Attendance recorded for ${event?.title}`,
        newValues: attendance,
      },
    );

    return attendance;
  }

  /**
   * Fetches an event profile alongside its detailed member attendance sheet.
   */
  async getEventRoster(eventId: string, userId?: string) {
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

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.VIEW_EVENT_ATTENDANCE,
        entity: 'Event',
        entityId: eventId,
        description: 'Viewed event attendance roster',
      },
    );

    return eventData;
  }
  /**
   * Admin-facing: all active events regardless of publish state.
   */
  async findAllForAdmin(): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }
}