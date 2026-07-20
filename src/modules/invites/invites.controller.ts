// invites.controller.ts
import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { SendInviteDto } from './dto/send-invite.dto';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Administrative endpoint to issue new invitations.
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendInvite(@Body() dto: SendInviteDto) {
    return await this.invitesService.sendInvite(dto);
  }

  /**
   * Verification check called by the UI client app when a user lands on the invite link.
   */
  @Get('verify')
  async verifyToken(@Query('token') token: string) {
    return await this.invitesService.validateToken(token);
  }
}