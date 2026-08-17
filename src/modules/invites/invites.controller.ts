import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type{ Response } from 'express';
import { InvitesService } from './invites.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
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

  @Post('accept')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitesService.acceptInvite(dto);

    // Set refresh cookie matching your auth setup
    response.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      user: result.user,
      tokens: { accessToken: result.tokens.accessToken },
    };
  }
}