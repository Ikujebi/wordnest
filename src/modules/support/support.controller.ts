import { Controller, Post, Patch, Body, Param, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { SupportService } from './support.service';
import { SubmitMessageDto } from './dto/submit-message.dto';
import { ResolveMessageDto } from './dto/resolve-message.dto';
import { AttachMediaDto } from './dto/attach-media.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('operations')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** Public Endpoint - No Guards required for Contact Form submission */
  @Post('contact-inbound')
  async submitContactForm(@Body() dto: SubmitMessageDto) {
    return this.supportService.recordInboundMessage(dto);
  }

  @Patch('tickets/:id/resolution')
  @UseGuards(JwtAuthGuard)
  async resolveInquiry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveMessageDto
  ) {
    return this.supportService.updateMessageResolution(id, dto);
  }

  @Post('media-gallery/assets')
  @UseGuards(JwtAuthGuard)
  async linkUploadedFile(@Req() req: any, @Body() dto: AttachMediaDto) {
    return this.supportService.catalogMediaAsset(dto, req.user.id);
  }
}