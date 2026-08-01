import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaGalleryService } from './mediaGallery.service';
import { CreateMediaGalleryDto } from './dto/create-media-gallery.dto';
import { UpdateMediaGalleryDto } from './dto/update-media-gallery.dto';
import { MediaGalleryQueryDto } from './dto/media-gallery-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('media-gallery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaGalleryController {
  constructor(private readonly mediaGalleryService: MediaGalleryService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() dto: CreateMediaGalleryDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.mediaGalleryService.createMedia(dto, req.user.id, file);
  }

  // Reads open to any authenticated user — most portals show media (banners, sermon
  // thumbnails) app-wide. Tighten to SUPER_ADMIN/ADMIN if this gallery is admin-only.
  @Get()
  async findAll(@Query() query: MediaGalleryQueryDto) {
    return this.mediaGalleryService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaGalleryService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaGalleryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.mediaGalleryService.updateMedia(id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaGalleryService.remove(id);
  }
}