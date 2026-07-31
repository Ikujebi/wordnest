import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { SetMaintenanceModeDto } from './dto/set-maintenance-mode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('metrics')
  getMetrics() {
    return this.systemService.getMetrics();
  }

  @Get('health')
  getHealth() {
    return this.systemService.getHealth();
  }

  @Get('maintenance-mode')
  getMaintenanceMode() {
    return this.systemService.getMaintenanceMode();
  }

  @Patch('maintenance-mode')
  setMaintenanceMode(@Req() req: any, @Body() dto: SetMaintenanceModeDto) {
    return this.systemService.setMaintenanceMode(dto.enabled, dto.message, req.user.id);
  }

  @Post('backup')
  triggerBackup(@Req() req: any) {
    return this.systemService.triggerBackup(req.user.id);
  }

  @Get('activity')
  getRecentActivity() {
    return this.systemService.getRecentActivity();
  }
}