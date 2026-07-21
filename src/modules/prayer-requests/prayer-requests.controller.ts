import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PrayerRequestsService } from './prayer-requests.service';

import { CreatePrayerRequestDto } from './dto/create-prayer-request.dto';
import { UpdatePrayerRequestDto } from './dto/update-prayer-request.dto';
import { AssignPrayerRequestDto } from './dto/assign-prayer-request.dto';
import { PrayerRequestNoteDto } from './dto/prayer-request-note.dto';

@Controller('prayer-requests')
export class PrayerRequestsController {
  constructor(
    private readonly prayerRequestsService: PrayerRequestsService,
  ) {}

  /**
   * Public website submission
   *
   * POST /api/prayer-requests
   */
  @Post()
  create(@Body() dto: CreatePrayerRequestDto) {
    return this.prayerRequestsService.create(dto);
  }

  /**
   * Admin get all requests
   *
   * GET /api/prayer-requests
   */
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.prayerRequestsService.findAll();
  }

  /**
   * Get list of eligible staff/workers for assignment
   *
   * GET /api/prayer-requests/assignees
   * (Placed above :id to prevent route shadowing)
   */
  @Get('assignees')
  getEligibleAssignees() {
    return this.prayerRequestsService.getEligibleAssignees();
  }

  /**
   * Admin view single prayer request
   *
   * GET /api/prayer-requests/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prayerRequestsService.findOne(id);
  }

  /**
   * Update prayer details
   *
   * PATCH /api/prayer-requests/:id
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrayerRequestDto,
  ) {
    return this.prayerRequestsService.update(id, dto);
  }

  /**
   * Assign prayer worker/team member
   *
   * PATCH /api/prayer-requests/:id/assign
   */
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignPrayerRequestDto,
  ) {
    return this.prayerRequestsService.assignPrayer(id, dto);
  }

  /**
   * Mark prayer as answered
   *
   * PATCH /api/prayer-requests/:id/answered
   */
  @Patch(':id/answered')
  answered(
    @Param('id') id: string,
    @Body('testimony') testimony?: string,
  ) {
    return this.prayerRequestsService.markAnswered(id, testimony);
  }

  /**
   * Prayer team sends message / adds note
   *
   * POST /api/prayer-requests/:id/notes
   */
  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: PrayerRequestNoteDto,
    @Req() req: any,
  ) {
    const authorId = req?.user?.id;
    const senderName = req?.user?.fullName || req?.user?.firstName;

    return this.prayerRequestsService.addNote(
      id,
      dto,
      authorId,
      senderName,
    );
  }

  /**
   * Archive prayer request
   *
   * DELETE /api/prayer-requests/:id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prayerRequestsService.remove(id);
  }
}