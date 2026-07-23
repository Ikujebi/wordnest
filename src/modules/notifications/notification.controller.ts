import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

// Replace with your actual auth guard, roles guard, decorators, and enum paths
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Audit logging imports
import { Audit } from '../audit-log/decorators/audit.decorator'; // Adjust import path to match your project
import { AuditAction } from '../audit-log/enums/audit-action.enum';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create notification
   *
   * Admin/system usage
   */
  @Audit({
    action: AuditAction.CREATE_NOTIFICATION,
    entity: 'Notification',
  })
  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
    @CurrentUser('id') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationService.findAll({
      ...query,
      userId,
    });
  }

  /**
   * Get unread count
   */
  @Get('stats/unread-count')
  async unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationService.unreadCount(userId);
  }

  /**
   * Notification statistics
   */
  @Get('stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async statistics() {
    return this.notificationService.statistics();
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
  @Audit({
    action: AuditAction.READ_NOTIFICATION,
    entity: 'Notification',
  })
  @Patch(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsRead(id);
  }

  /**
   * Mark all notifications read
   */
  @Audit({
    action: AuditAction.READ_ALL_NOTIFICATIONS,
    entity: 'Notification',
  })
  @Patch('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  /**
   * Delete notification
   */
  @Audit({
    action: AuditAction.DELETE_NOTIFICATION,
    entity: 'Notification',
  })
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationService.remove(id, userId);
  }

  /**
   * Delete old notifications
   *
   * Admin/system cleanup
   */
  @Audit({
    action: AuditAction.DELETE_OLD_NOTIFICATIONS,
    entity: 'Notification',
  })
  @Delete('cleanup/:days')
  @Roles(Role.SUPER_ADMIN)
  async cleanup(@Param('days') days: number) {
    return this.notificationService.removeOlderThan(Number(days));
  }
}