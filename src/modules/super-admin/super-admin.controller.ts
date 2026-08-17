import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  Delete,
  UseGuards,
  ParseEnumPipe,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Role } from '@prisma/client';

import { SuperAdminService } from './super-admin.service';
import { UpdateIndividualStatusDto } from './dto/update-individual-status.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AdminQueryDto } from './dto/admin-query.dto';
import { ToggleAdminStatusDto } from './dto/toggle-admin-status.dto';

// Auth Guards & Decorators
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

// Request interface with attached JWT user object
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
  @ApiOperation({ summary: 'Get global metrics and growth statistics' })
  async getDashboardStats() {
    return this.superAdminService.getDashboardStats();
  }

  @Get('dashboard/recent-provisionings')
  @ApiOperation({ summary: 'Get recent system provisioning audit logs' })
  async getRecentProvisionings() {
    return this.superAdminService.getRecentProvisionings();
  }

  // ==========================================
  //        SUPER ADMIN OWN PROFILE
  // ==========================================

  @Patch('profile')
  @ApiOperation({ summary: 'Update own account profile details' })
  async updateOwnProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Admin identification failed.');
    }

    return this.superAdminService.updateOwnProfile(userId, dto);
  }

  @Post('profile-picture')
  @ApiOperation({ summary: 'Upload or update own profile avatar image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('profilePicture'))
  async updateProfilePicture(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Admin identification failed.');
    }

    return this.superAdminService.updateProfilePicture(userId, file);
  }

  // ==========================================
  //        MEMBER APPROVAL MANAGEMENT
  // ==========================================

  @Get('approvals')
  @ApiOperation({ summary: 'List all accounts pending admin approval' })
  async listPendingApprovals() {
    return this.superAdminService.listPendingApprovals();
  }

  @Patch('approvals/:id/approve')
  @ApiOperation({ summary: 'Approve a pending user registration' })
  async approveUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }
    return this.superAdminService.approveUser(performingAdminId, id);
  }

  @Patch('approvals/:id/reject')
  @ApiOperation({ summary: 'Reject a pending user registration' })
  async rejectUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }
    return this.superAdminService.rejectUser(performingAdminId, id);
  }

  // ==========================================
  //        INDIVIDUAL TARGETING ROUTES
  // ==========================================

  @Get('users/role')
  @ApiOperation({ summary: 'Retrieve all users belonging to a specific Role' })
  async getIndividualsByRole(
    @Query('role', new ParseEnumPipe(Role)) role: Role,
  ) {
    return this.superAdminService.getIndividualsByRole(role);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get detailed profile for a specific user ID' })
  async targetIndividualUser(@Param('id') userId: string) {
    return this.superAdminService.targetIndividualUser(userId);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update target user role or active status' })
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

  // ==========================================
  //        ADMIN MANAGEMENT ROUTES
  // ==========================================

  @Get('admins')
  @ApiOperation({ summary: 'List admin and super-admin accounts, paginated and filterable' })
  async listAdmins(@Query() query: AdminQueryDto) {
    return this.superAdminService.listAdmins(query);
  }

  @Patch('admins/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate an admin account' })
  async toggleAdminStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ToggleAdminStatusDto,
  ) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }
    return this.superAdminService.toggleAdminStatus(performingAdminId, id, dto.isActive);
  }

  @Delete('admins/:id')
  @ApiOperation({ summary: 'Permanently deactivate/delete an admin account' })
  async deleteAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }
    return this.superAdminService.deleteAdmin(performingAdminId, id);
  }
  @Post('approvals/:id/resend-verification')
async resendVerification(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
  const performingAdminId = req.user?.id;
  if (!performingAdminId) throw new UnauthorizedException('Admin identification failed.');
  return this.superAdminService.resendPendingVerification(performingAdminId, id);
}

@Delete('approvals/:id')
async deletePendingAccount(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
  const performingAdminId = req.user?.id;
  if (!performingAdminId) throw new UnauthorizedException('Admin identification failed.');
  return this.superAdminService.hardDeletePendingUser(performingAdminId, id);
}
}