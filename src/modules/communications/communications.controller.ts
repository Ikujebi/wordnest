import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { CommunicationsService } from './communications.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Req() req: any, @Body() dto: CreateBroadcastDto) {
    // createdById is set from the authenticated user, never trusted from the body
    return this.communicationsService.create({ ...dto, createdById: req.user.id });
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(@Query() query: CommunicationQueryDto) {
    return this.communicationsService.findAll(query);
  }

  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  dashboardOverview() {
    return this.communicationsService.dashboardOverview();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateBroadcastDto,
  ) {
    return this.communicationsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.remove(id, req.user.id);
  }

  @Post(':id/send-newsletter')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  sendNewsletter(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: SendNewsletterDto,
  ) {
    return this.communicationsService.sendNewsletter(id, dto, req.user.id);
  }

  @Post(':id/send')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  sendNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: SendNotificationDto,
  ) {
    return this.communicationsService.sendNotification(id, dto, req.user.id);
  }

  @Post(':id/schedule')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  schedule(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.schedule(id, req.user.id);
  }

  @Post(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.cancel(id, req.user.id);
  }

  @Post(':id/duplicate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  duplicate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.duplicate(id, req.user.id);
  }

  @Get(':id/recipients')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  recipients(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.previewRecipients(id);
  }

  @Get(':id/statistics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  statistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.statistics(id);
  }

  @Get(':id/preview')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.preview(id);
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.restore(id, req.user.id);
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  archive(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.archive(id, req.user.id);
  }
}