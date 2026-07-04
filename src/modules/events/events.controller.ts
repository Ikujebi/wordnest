import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async create(@Req() req: any, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.createEvent(createEventDto, req.user.id);
  }

  @Get()
  async getAllActive() {
    return this.eventsService.findAllActive();
  }

  @Get(':id/roster')
  async getRoster(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.eventsService.getEventRoster(eventId);
  }

  @Post(':id/attendance')
  async logAttendance(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() recordAttendanceDto: RecordAttendanceDto
  ) {
    return this.eventsService.recordAttendance(eventId, recordAttendanceDto);
  }
}