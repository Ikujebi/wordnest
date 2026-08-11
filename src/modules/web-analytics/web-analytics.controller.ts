import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { WebAnalyticsService } from './web-analytics.service';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { Role } from '@prisma/client';

@Controller('web-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class WebAnalyticsController {
  constructor(
    private readonly webAnalyticsService: WebAnalyticsService,
  ) {}

  /**
   * GET /web-analytics/visitors
   *
   * Example:
   * /web-analytics/visitors?days=30
   */
  @Get('visitors')
  async getVisitorBreakdown(
    @Query('days') days?: string,
  ) {
    const parsedDays = days
      ? Number(days)
      : 30;

    return this.webAnalyticsService.getVisitorBreakdown(
      parsedDays,
    );
  }

  /**
   * POST /web-analytics/sync
   *
   * Manually synchronize today's analytics.
   */
  @Post('sync')
  async triggerSync() {
    await this.webAnalyticsService.syncDailySnapshot();

    return {
      message:
        'Daily analytics snapshot synced successfully.',
    };
  }
}