import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path
import { CloudinaryService } from '../../cloudinary/cloudinary.service'; // Adjust path

@Injectable()
export class MediaGalleryService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  async saveBroadcastImage(file: Express.Multer.File, title: string, adminId: string) {
    // Validate User role/existence via Prisma schema constraints
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new BadRequestException('Admin user context not found.');

    // 1. Send to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(file, {
      folder: 'email-broadcasts',
    });

    // 2. Save metadata reference in Postgres
    return this.prisma.mediaGallery.create({
      data: {
        title: title || 'Broadcast Media Attachment',
        type: 'IMAGE', // Matches your MediaType enum perfectly
        url: uploadResult.secure_url,
        thumbnail: uploadResult.secure_url,
        description: `Cloudinary Public ID: ${uploadResult.public_id}`,
        uploadedById: adminId,
      },
    });
  }
}