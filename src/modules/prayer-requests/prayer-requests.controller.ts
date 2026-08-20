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
import { PrayerLeaderGuard } from './guards/prayer-leader.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

@Controller('prayer-requests')
export class PrayerRequestsController {
  constructor(private readonly prayerRequestsService: PrayerRequestsService) { }

  /**
   * Public submission route — reachable without login. If the caller IS
   * logged in, OptionalJwtAuthGuard populates req.user so the request can
   * be linked to their account (unless dto.anonymous is set).
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreatePrayerRequestDto, @Req() req: any) {
    return this.prayerRequestsService.create(dto, req.user?.id);
  }

  /**
   * Full list — Super Admin or any active Prayer Department member
   * (LEADER or MEMBER).
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
   * A logged-in user's own submitted prayer requests.
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-requests')
  findMyRequests(@Req() req: any) {
    return this.prayerRequestsService.findMyRequests(req.user.id);
  }
  /**
   * Assignee list for the "Assign to" dropdown — any active Prayer
   * Department member or Super Admin can view it, since the dropdown
   * itself is just informational; the actual assignment action below is
   * what's restricted to leaders.
   */
  @UseGuards(JwtAuthGuard, PrayerAccessGuard)
  @Get('eligible-assignees')
  getEligibleAssignees() {
    return this.prayerRequestsService.getEligibleAssignees();
  }

  /**
   * Single item — accessible to full managers, assigned intercessors, OR the requester.
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
   * accessible to managers, assigned intercessors, or the requester.
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdatePrayerStatusDto, @Req() req: any) {
    await this.prayerRequestsService.assertCanAccess(id, req.user.id, req.user.role);
    return this.prayerRequestsService.updateStatus(id, dto.status, req.user.id);
  }

  /**
   * Assignment is exclusively a Prayer Department LEADER or Super Admin
   * action — a regular MEMBER-role department member can view/work
   * requests (see findAll/my-assigned) but cannot assign them to others.
   */
  @UseGuards(JwtAuthGuard, PrayerLeaderGuard)
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