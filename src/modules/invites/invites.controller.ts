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

  @Get('validate/:token')
  async validateToken(@Param('token') token: string) {
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

  // NOTE: @Get('pending') is placed before any parameterized @Get(':id') route to prevent route collision.
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