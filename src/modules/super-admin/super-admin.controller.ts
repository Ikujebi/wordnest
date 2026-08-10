import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseEnumPipe,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { UpdateIndividualStatusDto } from './dto/update-individual-status.dto';
import { Role } from '@prisma/client';

// Define a custom interface for authenticated requests
interface AuthenticatedRequest {
  user?: {
    id: string;
    email?: string;
    role?: Role;
  };
}

// Uncomment these once your Auth Guards are ready for production
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('super-admin')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // ==========================================
  //          GLOBAL DASHBOARD ROUTES
  // ==========================================

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.superAdminService.getDashboardStats();
  }

  @Get('dashboard/recent-provisionings')
  async getRecentProvisionings() {
    return this.superAdminService.getRecentProvisionings();
  }

  // ==========================================
  //        INDIVIDUAL TARGETING ROUTES
  // ==========================================

  @Get('users/role')
  async getIndividualsByRole(
    @Query('role', new ParseEnumPipe(Role)) role: Role,
  ) {
    return this.superAdminService.getIndividualsByRole(role);
  }

  @Get('users/:id')
  async targetIndividualUser(@Param('id') userId: string) {
    return this.superAdminService.targetIndividualUser(userId);
  }

  @Patch('users/:id/status')
  async updateIndividualStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') userId: string,
    @Body() dto: UpdateIndividualStatusDto,
  ) {
    const performingAdminId = req.user?.id;

    return this.superAdminService.updateIndividualStatus(
      performingAdminId!,
      userId,
      dto,
    );
  }
}