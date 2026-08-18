import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { PendingInvitesQueryDto } from './dto/pending-invites-query.dto';

// Auth Guards & Decorators
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async sendInvite(@Body() dto: SendInviteDto) {
    return this.invitesService.sendInvite(dto);
  }

  // Matches InviteClient.verifyToken via /api/invites/verify?token=...
  @Get('verify')
  async verifyToken(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Invitation token is required.');
    }
    return this.invitesService.validateToken(token);
  }

  // Legacy/Fallback route support for URL parameter pattern (/api/invites/validate/:token)
  @Get('validate/:token')
  async validateToken(@Param('token') token: string) {
    if (!token) {
      throw new BadRequestException('Invitation token is required.');
    }
    return this.invitesService.validateToken(token);
  }

  @Post('accept')
  async acceptInvite(
    @Body()
    dto: {
      token: string;
      fullName: string;
      password: string;
      phoneNumber?: string;
    },
  ) {
    return this.invitesService.acceptInvite(dto);
  }

  // NOTE: Static routes like 'pending' MUST stay above parameterized routes like ':id'
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async listPending(@Query() query: PendingInvitesQueryDto) {
    return this.invitesService.listPending(query.roles);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async resendInvite(@Req() req: any, @Param('id') id: string) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }
    return this.invitesService.resendInvite(id, performingAdminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async cancelInvite(@Req() req: any, @Param('id') id: string) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId) {
      throw new UnauthorizedException('Admin identification failed.');
    }
    return this.invitesService.cancelInvite(id, performingAdminId);
  }
}