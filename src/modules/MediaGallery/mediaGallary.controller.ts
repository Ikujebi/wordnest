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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaGalleryService } from './mediaGallery.service';
import { CreateMediaGalleryDto } from './dto/create-media-gallery.dto';
import { UpdateMediaGalleryDto } from './dto/update-media-gallery.dto';
import { MediaGalleryQueryDto } from './dto/media-gallery-query.dto';
// Import your auth/jwt guard and current user decorator if applicable

@Controller('media-gallery')
export class MediaGalleryController {
  constructor(private readonly mediaGalleryService: MediaGalleryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() dto: CreateMediaGalleryDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any, // Access user ID from request context (e.g. req.user.id)
  ) {
    const adminId = req.user?.id; 
    return this.mediaGalleryService.createMedia(dto, adminId, file);
  }

  @Get()
  async findAll(@Query() query: MediaGalleryQueryDto) {
    return this.mediaGalleryService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.mediaGalleryService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaGalleryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.mediaGalleryService.updateMedia(id, dto, file);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.mediaGalleryService.remove(id);
  }
}