// invites.controller.ts
import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async sendInvite(@Body() dto: SendInviteDto) {
    return this.invitesService.sendInvite(dto);
  }

  // Public — anyone with a valid token needs to be able to verify it
  // without being logged in yet.
  @Get('verify')
  async verifyToken(@Query('token') token: string) {
    return this.invitesService.validateToken(token);
  }
}