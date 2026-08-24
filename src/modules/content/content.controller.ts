import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { UploadSermonDto } from './dto/upload-sermon.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('sermons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async catalogSermon(@Body() dto: UploadSermonDto) {
    return this.contentService.logSermon(dto);
  }
}