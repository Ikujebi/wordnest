import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  Res,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
  UseGuards,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseInterceptors,
} from '@nestjs/common';
import type{ Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommunicationsService } from './communications.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator'; // Adjust import if your public decorator is located elsewhere
import { Role } from '@prisma/client';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationsController {
  private readonly logger = new Logger(CommunicationsController.name);

  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  /* ========================================================================
   * WHATSAPP WEBHOOK ENDPOINTS (PUBLIC)
   * ======================================================================== */

  /**
   * GET /communications/whatsapp/webhook
   * Meta Developer Dashboard Verification Handshake
   */
  @Public() // Bypasses JwtAuthGuard if global guard is active
  @Get('whatsapp/webhook')
  verifyWhatsappWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expectedVerifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === expectedVerifyToken) {
      this.logger.log('WhatsApp Webhook verified successfully!');
      return res.status(HttpStatus.OK).send(challenge);
    }

    this.logger.warn(`WhatsApp Webhook verification failed. Received token: ${token}`);
    return res.status(HttpStatus.FORBIDDEN).send('Verification failed');
  }

  /**
   * POST /communications/whatsapp/webhook
   * Receives incoming delivery status updates (sent, delivered, read, failed)
   */
  @Public() // Bypasses JwtAuthGuard if global guard is active
  @Post('whatsapp/webhook')
  async handleWhatsappWebhook(@Body() body: any, @Res() res: Response) {
    // Meta requires an immediate 200 OK acknowledgment
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');

    try {
      if (body.object === 'whatsapp_business_account') {
        // Delegate event processing asynchronously to your service
        await this.communicationsService.handleWhatsappWebhookEvent(body);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing WhatsApp Webhook payload: ${err.message}`, err.stack);
    }
  }

  /* ========================================================================
   * BROADCAST & COMMUNICATION ENDPOINTS (PROTECTED)
   * ======================================================================== */

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Req() req: any, @Body() dto: CreateBroadcastDto) {
    return this.communicationsService.create(dto, req.user.id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(@Query() query: CommunicationQueryDto) {
    return this.communicationsService.findAll(query);
  }

  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  dashboardOverview() {
    return this.communicationsService.dashboardOverview();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateBroadcastDto,
  ) {
    return this.communicationsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.remove(id, req.user.id);
  }

  @Post(':id/send-newsletter')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  sendNewsletter(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: SendNewsletterDto,
  ) {
    return this.communicationsService.sendNewsletter(id, dto, req.user.id);
  }

  @Post(':id/send')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  sendNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: SendNotificationDto,
  ) {
    return this.communicationsService.sendNotification(id, dto, req.user.id);
  }

  @Post(':id/schedule')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  schedule(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.schedule(id, req.user.id);
  }

  @Post(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.cancel(id, req.user.id);
  }

  @Post(':id/duplicate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  duplicate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.duplicate(id, req.user.id);
  }

  @Get(':id/recipients')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  recipients(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.previewRecipients(id);
  }

  @Get(':id/statistics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  statistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.statistics(id);
  }

  @Get(':id/preview')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.preview(id);
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.restore(id, req.user.id);
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  archive(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.communicationsService.archive(id, req.user.id);
  }

  @Post('upload-image')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.cloudinaryService.uploadFile(file, { folder: 'broadcast-images' });
    return { url: result.secure_url };
  }
}