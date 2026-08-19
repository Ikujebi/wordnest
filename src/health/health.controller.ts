// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';

// Deliberately its own tiny controller, not folded into SystemController.
// This route must NEVER require auth, NEVER hit the DB, and NEVER be
// affected by changes to other controllers' guards. Its only job is to
// answer instantly so cron pingers and the frontend can wake a sleeping
// Render instance and know when it's safe to proceed with a real request
// (e.g. sign in) without hitting the 30s client timeout.
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}