import { Module } from '@nestjs/common';
import { MediaGalleryService } from './mediaGallery.service';
import { MediaGalleryController } from './mediaGallary.controller';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module'; // Adjust path to where your provider lives
import { PrismaModule } from '../../prisma/prisma.module'; // Adjust path

@Module({
  imports: [CloudinaryModule, PrismaModule],
  controllers: [MediaGalleryController],
  providers: [MediaGalleryService],
  exports: [MediaGalleryService], // Exporting allows other modules (like Broadcasts) to utilize it directly
})
export class MediaGalleryModule {}