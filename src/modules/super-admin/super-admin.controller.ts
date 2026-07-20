import { Controller, Get, Patch, Param, Query, Body, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';

// 1. Define a explicit validation DTO for your status update route
export class UpdateUserStatusDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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

  // 2. Add ParseEnumPipe to catch bad enum strings early at the gateway layer
  @Get('users')
  async getUsersByRole(
    @Query('role', new ParseEnumPipe(Role, { errorHttpStatusCode: 400 })) role: Role
  ) {
    return this.superAdminService.getIndividualsByRole(role);
  }

  @Get('users/:id')
  async getIndividual(@Param('id') id: string) {
    return this.superAdminService.targetIndividualUser(id);
  }

  // 3. Swap the loose body type for your new secure validation DTO
  @Patch('users/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto
  ) {
    return this.superAdminService.updateIndividualStatus(id, body);
  }
}