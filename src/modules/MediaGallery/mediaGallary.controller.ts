import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaGalleryService } from './mediaGallery.service';

@Controller('admin/media')
export class MediaGalleryController {
  constructor(private readonly mediaGalleryService: MediaGalleryService) {}

  @Post('upload-broadcast')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBroadcastAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('adminId') adminId: string,
  ) {
    const asset = await this.mediaGalleryService.saveBroadcastImage(file, title, adminId);
    return {
      success: true,
      imageUrl: asset.url,
      mediaId: asset.id,
    };
  }
}