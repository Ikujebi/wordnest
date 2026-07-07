import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CommunicationsService } from './communications.service';

import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';

@Controller('communications')
export class CommunicationsController {
  constructor(
    private readonly communicationsService: CommunicationsService,
  ) {}

  /**
   * Create a draft communication.
   */
  @Post()
  create(
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.communicationsService.create(dto);
  }

  /**
   * Get all communications.
   */
  @Get()
  findAll(
    @Query() query: CommunicationQueryDto,
  ) {
    return this.communicationsService.findAll(query);
  }

  /**
   * Get communication by id.
   */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.findOne(id);
  }

  /**
   * Update communication.
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBroadcastDto,
  ) {
    return this.communicationsService.update(id, dto);
  }

  /**
   * Soft delete.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.remove(id);
  }

  /**
   * Send newsletter.
   */
  @Post(':id/send-newsletter')
  sendNewsletter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendNewsletterDto,
  ) {
    return this.communicationsService.sendNewsletter(id, dto);
  }

  /**
   * Broadcast notification.
   */
  @Post(':id/send')
  sendNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendNotificationDto,
  ) {
    return this.communicationsService.sendNotification(id, dto);
  }

  /**
   * Schedule communication.
   */
  @Post(':id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.schedule(id);
  }

  /**
   * Cancel scheduled communication.
   */
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.cancel(id);
  }

  /**
   * Duplicate communication.
   */
  @Post(':id/duplicate')
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.duplicate(id);
  }

  /**
   * Preview recipients.
   */
  @Get(':id/recipients')
  recipients(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.previewRecipients(id);
  }

  /**
   * Delivery statistics.
   */
  @Get(':id/statistics')
  statistics(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.statistics(id);
  }

  /**
   * Preview communication.
   */
  @Get(':id/preview')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.preview(id);
  }

  /**
   * Restore deleted communication.
   */
  @Patch(':id/restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.restore(id);
  }

  /**
   * Archive communication.
   */
  @Patch(':id/archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communicationsService.archive(id);
  }
}