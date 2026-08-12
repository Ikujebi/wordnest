import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PrayerRequestsService } from './prayer-requests.service';
import { CreatePrayerRequestDto } from './dto/create-prayer-request.dto';
import { UpdatePrayerRequestDto } from './dto/update-prayer-request.dto';
import { AssignPrayerRequestDto } from './dto/assign-prayer-request.dto';
import { PrayerRequestNoteDto } from './dto/prayer-request-note.dto';
import { UpdatePrayerStatusDto } from './dto/update-prayer-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrayerAccessGuard } from './guards/prayer-access.guard';

@Controller('prayer-requests')
export class PrayerRequestsController {
  constructor(private readonly prayerRequestsService: PrayerRequestsService) {}

  /**
   * Public submission route — no auth required. Anyone on the public
   * website can submit a prayer request.
   */
  @Post()
  create(@Body() dto: CreatePrayerRequestDto, @Req() req: any) {
    const actorId = req.user?.id;
    return this.prayerRequestsService.create(dto, actorId);
  }

  /**
   * Full list — Super Admin or Prayer Department leader only.
   */
  @UseGuards(JwtAuthGuard, PrayerAccessGuard)
  @Get()
  findAll() {
    return this.prayerRequestsService.findAll();
  }

  /**
   * Self-service — any authenticated user sees only what's assigned to
   * them. This is how regular Prayer Department workers interact with
   * assignments without getting the full management view.
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-assigned')
  findMyAssigned(@Req() req: any) {
    return this.prayerRequestsService.findMyAssigned(req.user.id);
  }

  /**
   * Assignee list for the "Assign to" dropdown — leader/super-admin only,
   * since only they perform assignment.
   */
  @UseGuards(JwtAuthGuard, PrayerAccessGuard)
  @Get('eligible-assignees')
  getEligibleAssignees() {
    return this.prayerRequestsService.getEligibleAssignees();
  }

  /**
   * Single item — accessible to full managers OR the assignee themself.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.prayerRequestsService.assertCanAccess(id, req.user.id, req.user.role);
    return this.prayerRequestsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PrayerAccessGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePrayerRequestDto, @Req() req: any) {
    return this.prayerRequestsService.update(id, dto, req.user.id);
  }

  /**
   * Dedicated status endpoint (matches frontend's updatePrayerStatus) —
   * accessible to managers or the assignee working the request.
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdatePrayerStatusDto, @Req() req: any) {
    await this.prayerRequestsService.assertCanAccess(id, req.user.id, req.user.role);
    return this.prayerRequestsService.updateStatus(id, dto.status, req.user.id);
  }

  /**
   * Assignment is exclusively a manager action.
   */
  @UseGuards(JwtAuthGuard, PrayerAccessGuard)
  @Patch(':id/assign')
  assignPrayer(@Param('id') id: string, @Body() dto: AssignPrayerRequestDto, @Req() req: any) {
    return this.prayerRequestsService.assignPrayer(id, dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/mark-answered')
  async markAnswered(
    @Param('id') id: string,
    @Body('testimony') testimony: string,
    @Req() req: any,
  ) {
    await this.prayerRequestsService.assertCanAccess(id, req.user.id, req.user.role);
    return this.prayerRequestsService.markAnswered(id, testimony, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/notes')
  async addNote(@Param('id') id: string, @Body() dto: PrayerRequestNoteDto, @Req() req: any) {
    await this.prayerRequestsService.assertCanAccess(id, req.user.id, req.user.role);
    return this.prayerRequestsService.addNote(id, dto, req.user.id, req.user.fullName);
  }

  /**
   * Archiving/removal is exclusively a manager action.
   */
  @UseGuards(JwtAuthGuard, PrayerAccessGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.prayerRequestsService.remove(id, req.user.id);
  }
}