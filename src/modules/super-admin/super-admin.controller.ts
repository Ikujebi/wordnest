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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { UpdateIndividualStatusDto } from './dto/update-individual-status.dto';
import { Role } from '@prisma/client';

// Auth Imports
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

// Custom interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: Role;
  };
}

@ApiTags('Super Admin')
@ApiBearerAuth()
@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
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

    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }

    return this.superAdminService.updateIndividualStatus(
      performingAdminId,
      userId,
      dto,
    );
  }
}