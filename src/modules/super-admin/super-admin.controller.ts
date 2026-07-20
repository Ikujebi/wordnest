import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('api/super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  async getStats() {
    return this.superAdminService.getDashboardStats();
  }

  @Get('logs')
  async getLogs() {
    return this.superAdminService.getRecentProvisionings();
  }

  // Target collections by explicit Prisma Role Enum values: MEMBER | ADMIN | SUPER_ADMIN
  @Get('users')
  async getUsersByRole(@Query('role') role: Role) {
    return this.superAdminService.getIndividualsByRole(role);
  }

  // Target a single detailed entity profile
  @Get('users/:id')
  async getIndividual(@Param('id') id: string) {
    return this.superAdminService.targetIndividualUser(id);
  }

  // Perform operational management updates on targeted user
  @Patch('users/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { role?: Role; isActive?: boolean }
  ) {
    return this.superAdminService.updateIndividualStatus(id, body);
  }
}