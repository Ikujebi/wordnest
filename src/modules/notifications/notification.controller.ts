import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

// Fix 1 & 2: Import Request type safely alongside custom AuthenticatedRequest
import type { Request } from 'express';

import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

// Replace with your actual auth guard path
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Fix 2: Interface extending Express Request with authenticated user
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    [key: string]: any;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create notification
   *
   * Admin/system usage
   */
  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  /**
   * Get notifications
   *
   * Supports:
   * pagination, search, filtering
   */
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationQueryDto,
  ) {
    // Fix 3: Merge userId and query DTO into a single params object expected by service.findAll
    return this.notificationService.findAll({
      ...query,
      userId: req.user.id,
    });
  }

  /**
   * Get single notification
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.findOne(id);
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsRead(id);
  }

  /**
   * Mark all notifications read
   */
  @Patch('read-all')
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  /**
   * Get unread count
   */
  @Get('stats/unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.unreadCount(req.user.id);
  }

  /**
   * Notification statistics
   */
  @Get('stats')
  async statistics() {
    return this.notificationService.statistics();
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationService.remove(id, req.user.id);
  }

  /**
   * Delete old notifications
   *
   * Admin/system cleanup
   */
  @Delete('cleanup/:days')
  async cleanup(@Param('days') days: number) {
    return this.notificationService.removeOlderThan(Number(days));
  }
}