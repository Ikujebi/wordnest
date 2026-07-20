import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('api/super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN') // 🔥 CRITICAL: Only allow SUPER_ADMIN accounts here (exclude standard ADMINs)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('dashboard-stats')
  async getDashboardStats() {
    return this.superAdminService.getDashboardStats();
  }

  @Get('recent-provisionings')
  async getRecentProvisionings() {
    return this.superAdminService.getRecentProvisionings();
  }
}