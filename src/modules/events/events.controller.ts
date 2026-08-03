import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async create(@Req() req: any, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.createEvent(createEventDto, req.user.id);
  }

  /**
   * Public-facing: published events only.
   */
  @Get()
  async getAllActive() {
    return this.eventsService.findAllActive();
  }

  /**
   * Admin-facing: all events including drafts.
   */
  @Get('admin')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getAllForAdmin() {
    return this.eventsService.findAllForAdmin();
  }

  @Get(':id/roster')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getRoster(@Param('id', ParseUUIDPipe) eventId: string, @Req() req: any) {
    return this.eventsService.getEventRoster(eventId, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(id, updateEventDto, req.user.id);
  }

  @Patch(':id/publish')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async publish(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.eventsService.publishEvent(id, req.user.id);
  }

  @Patch(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.eventsService.cancelEvent(id, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.eventsService.deleteEvent(id, req.user.id);
  }

  @Post(':id/attendance')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async logAttendance(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() recordAttendanceDto: RecordAttendanceDto,
  ) {
    return this.eventsService.recordAttendance(eventId, recordAttendanceDto);
  }

  @Post(':id/rsvp')
  async rsvp(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.eventsService.rsvp(id, req.user.id);
  }

  @Delete(':id/rsvp')
  async cancelRsvp(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.eventsService.cancelRsvp(id, req.user.id);
  }
}