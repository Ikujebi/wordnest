import {
  BadRequestException,
  Body,
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

import { TrackAnalyticsEventDto } from '../../../types/visits';

@Controller('web-analytics')
export class WebAnalyticsController {
  constructor(
    private readonly webAnalyticsService: WebAnalyticsService,
  ) {}

  /**
   * PUBLIC ANALYTICS TRACKING ENDPOINT
   *
   * POST /web-analytics/track
   *
   * This endpoint is called by the public website.
   */
  @Post('track')
  async trackEvent(
    @Body() body: TrackAnalyticsEventDto,
  ) {
    if (!body.visitorId) {
      throw new BadRequestException(
        'visitorId is required.',
      );
    }

    if (!body.sessionId) {
      throw new BadRequestException(
        'sessionId is required.',
      );
    }

    if (!body.event) {
      throw new BadRequestException(
        'event is required.',
      );
    }

    await this.webAnalyticsService.trackEvent(
      body,
    );

    return {
      success: true,
    };
  }

  /**
   * ADMIN ANALYTICS
   *
   * GET /web-analytics/visitors
   */
  @Get('visitors')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
  )
  async getVisitorBreakdown(
    @Query('days') days?: string,
  ) {
    let parsedDays = 30;

    if (days !== undefined) {
      parsedDays = Number(days);

      if (
        !Number.isInteger(parsedDays) ||
        parsedDays < 1 ||
        parsedDays > 365
      ) {
        throw new BadRequestException(
          'days must be an integer between 1 and 365.',
        );
      }
    }

    return this.webAnalyticsService.getVisitorBreakdown(
      parsedDays,
    );
  }

  /**
   * MANUAL DAILY SNAPSHOT
   *
   * POST /web-analytics/sync
   */
  @Post('sync')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
  )
  async triggerSync() {
    await this.webAnalyticsService.syncDailySnapshot();

    return {
      message:
        'Daily analytics snapshot generated successfully.',
    };
  }
}