import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { MediaType, NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';
import { CreateMediaGalleryDto } from './dto/create-media-gallery.dto';
import { MediaGalleryQueryDto } from './dto/media-gallery-query.dto';
import { UpdateMediaGalleryDto } from './dto/update-media-gallery.dto';

@Injectable()
export class MediaGalleryService {
  private readonly logger = new Logger(MediaGalleryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Directly save a broadcast image attachment (used by Broadcasts Module).
   */
  async saveBroadcastImage(
    file: Express.Multer.File,
    title: string,
    adminId: string,
  ) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });
    if (!admin) {
      throw new BadRequestException('Admin user context not found.');
    }

    const uploadResult = await this.cloudinaryService.uploadFile(file, {
      folder: 'email-broadcasts',
    });

    const media = await this.prisma.mediaGallery.create({
      data: {
        title: title || 'Broadcast Media Attachment',
        type: MediaType.IMAGE,
        url: uploadResult.secure_url,
        thumbnail: uploadResult.secure_url,
        description: `Cloudinary Public ID: ${uploadResult.public_id}`,
        uploadedById: adminId,
      },
    });

    // Audit Log
    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: AuditAction.CREATE_MEDIA_GALLERY,
        entity: 'MediaGallery',
        entityId: media.id,
        description: `Uploaded broadcast image "${media.title}"`,
        newValues: media,
      },
    );

    return media;
  }

  /**
   * Upload and register a new media asset.
   */
  async createMedia(
    dto: CreateMediaGalleryDto,
    adminId: string,
    file?: Express.Multer.File,
  ) {
    let fileUrl = dto.url;
    let thumbnailUrl = dto.thumbnail;

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file, {
        folder: 'media-gallery',
      });
      fileUrl = uploadResult.secure_url;
      thumbnailUrl = uploadResult.secure_url;
    }

    if (!fileUrl) {
      throw new BadRequestException(
        'An image file or a valid URL must be provided.',
      );
    }

    try {
      const media = await this.prisma.mediaGallery.create({
        data: {
          title: dto.title,
          type: dto.type ?? MediaType.IMAGE,
          description: dto.description ?? null,
          url: fileUrl,
          thumbnail: thumbnailUrl ?? null,
          uploadedById: adminId,
        },
        include: {
          uploadedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      // 1. Audit Log
      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.CREATE_MEDIA_GALLERY,
          entity: 'MediaGallery',
          entityId: media.id,
          description: `Uploaded new media asset "${media.title}"`,
          newValues: media,
        },
      );

      // 2. Admin Notification
      await this.notificationService.notifyAdmins({
        title: 'New Media Asset Uploaded',
        message: `Media "${media.title}" was added to the media gallery.`,
        type: NotificationType.INFO,
      });

      return media;
    } catch (error) {
      this.logger.error(
        'Failed to create media gallery record',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not save media asset.');
    }
  }

  /**
   * Retrieve paginated list of media items.
   */
  async findAll(query: MediaGalleryQueryDto) {
    const { page = 1, limit = 10, search, type } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MediaGalleryWhereInput = {
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    try {
      const [data, total] = await Promise.all([
        this.prisma.mediaGallery.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: {
              select: { id: true, fullName: true }, // FIX: Replaced firstName & lastName with fullName
            },
          },
        }),
        this.prisma.mediaGallery.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch media gallery',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Error retrieving media gallery.',
      );
    }
  }

  /**
   * Find a single media item by ID.
   */
  async findOne(id: string) {
    const item = await this.prisma.mediaGallery.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, fullName: true, email: true }, // FIX: Replaced firstName & lastName with fullName
        },
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Media asset with ID "${id}" was not found.`,
      );
    }

    return item;
  }

  /**
   * Update metadata or replace uploaded image.
   */
  async updateMedia(
    id: string,
    dto: UpdateMediaGalleryDto,
    adminId?: string,
    file?: Express.Multer.File,
  ) {
    const existing = await this.findOne(id);
    const before = { ...existing };

    let url = dto.url ?? existing.url;
    let thumbnail = dto.thumbnail ?? existing.thumbnail;

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file, {
        folder: 'media-gallery',
      });
      url = uploadResult.secure_url;
      thumbnail = uploadResult.secure_url;
    }

    try {
      const updatedMedia = await this.prisma.mediaGallery.update({
        where: { id },
        data: {
          title: dto.title,
          type: dto.type,
          description: dto.description,
          url,
          thumbnail,
        },
      });

      // Audit Log
      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.UPDATE_MEDIA_GALLERY,
          entity: 'MediaGallery',
          entityId: updatedMedia.id,
          description: `Updated media asset "${updatedMedia.title}"`,
          oldValues: before,
          newValues: updatedMedia,
        },
      );

      return updatedMedia;
    } catch (error) {
      this.logger.error(
        `Failed to update media asset ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not update media asset.');
    }
  }

  /**
   * Delete a media asset.
   */
  async remove(id: string, adminId?: string) {
    const media = await this.findOne(id);

    try {
      await this.prisma.mediaGallery.delete({
        where: { id },
      });

      // Audit Log
      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.DELETE_MEDIA_GALLERY,
          entity: 'MediaGallery',
          entityId: id,
          description: `Deleted media asset "${media.title}"`,
          oldValues: media,
        },
      );

      return { message: 'Media asset successfully deleted.' };
    } catch (error) {
      this.logger.error(
        `Failed to delete media asset ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not delete media asset.');
    }
  }
}