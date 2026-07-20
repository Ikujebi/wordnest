import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN') // Safeguard: Only users with the ADMIN role can hit these endpoints
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  // Route to get a high-level list of all members
  @Get('members')
  async getAllMembers() {
    return this.adminService.listAllMembers();
  }

  // Route to target a single member profile specifically
  @Get('members/:id')
  async getMemberDetail(@Param('id') id: string) {
    return this.adminService.targetIndividualMember(id);
  }
}