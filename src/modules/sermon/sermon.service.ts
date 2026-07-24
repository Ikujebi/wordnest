import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path
import { CloudinaryService } from '../../cloudinary/cloudinary.service'; // Adjust path
import { AuditLogService } from '../audit-log/audit-log.service'; // Adjust path
import { NotificationService } from '../notifications/notification.service'; // Adjust path
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationType, Prisma, Sermon } from '@prisma/client';
import { CreateSermonDto } from './dto/create-sermon.dto';
import { UpdateSermonDto } from './dto/update-sermon.dto';
import { SermonQueryDto } from './dto/sermon-query.dto';

@Injectable()
export class SermonService {
  private readonly logger = new Logger(SermonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new Sermon entry, with optional thumbnail upload via Cloudinary.
   */
  async createSermon(
    dto: CreateSermonDto,
    file?: Express.Multer.File,
  ): Promise<Sermon> {
    try {
      let thumbnailUrl = dto.thumbnailUrl;

      if (file) {
        const uploadResult = await this.cloudinaryService.uploadFile(file, {
          folder: 'sermons/thumbnails',
        });
        thumbnailUrl = uploadResult.secure_url;
      }

      const sermon = await this.prisma.sermon.create({
        data: {
          title: dto.title,
          preacher: dto.preacher,
          scriptureText: dto.scriptureText ?? null,
          summary: dto.summary ?? null,
          sermonDate: dto.sermonDate ? new Date(dto.sermonDate) : new Date(),
          audioUrl: dto.audioUrl ?? null,
          videoUrl: dto.videoUrl ?? null,
          thumbnailUrl: thumbnailUrl ?? null,
        },
      });

      // 1. Audit Log
      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.CREATE_SERMON,
          entity: 'Sermon',
          entityId: sermon.id,
          description: `Created sermon "${sermon.title}" by ${sermon.preacher}`,
          newValues: sermon,
        },
      );

      // 2. Notify Admins
      await this.notificationService.notifyAdmins({
        title: 'New Sermon Published',
        message: `Sermon "${sermon.title}" by ${sermon.preacher} is now available.`,
        type: NotificationType.INFO,
      });

      return sermon;
    } catch (error) {
      this.logger.error(
        'Failed to create sermon',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not publish sermon record.');
    }
  }

  /**
   * Paginated list retrieval with text filtering across preacher, title, summary, and scripture text.
   */
  async findAll(query: SermonQueryDto) {
    const { page = 1, limit = 10, search, preacher } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SermonWhereInput = {
      ...(preacher ? { preacher: { contains: preacher, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
              { preacher: { contains: search, mode: 'insensitive' } },
              { scriptureText: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      deletedAt: null,
    };

    try {
      const [data, total] = await Promise.all([
        this.prisma.sermon.findMany({
          where,
          skip,
          take: limit,
          orderBy: { sermonDate: 'desc' },
        }),
        this.prisma.sermon.count({ where }),
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
        'Failed to fetch sermons list',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Error retrieving sermons.');
    }
  }

  /**
   * Fetch single sermon details by ID.
   */
  async findOne(id: string): Promise<Sermon> {
    const sermon = await this.prisma.sermon.findFirst({
      where: { id, deletedAt: null },
    });

    if (!sermon) {
      throw new NotFoundException(`Sermon with ID "${id}" was not found.`);
    }

    return sermon;
  }

  /**
   * Update sermon details and handle optional thumbnail swapping.
   */
  async updateSermon(
    id: string,
    dto: UpdateSermonDto,
    file?: Express.Multer.File,
  ): Promise<Sermon> {
    const existingSermon = await this.findOne(id);
    const before = { ...existingSermon };

    let thumbnailUrl = dto.thumbnailUrl ?? existingSermon.thumbnailUrl;

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file, {
        folder: 'sermons/thumbnails',
      });
      thumbnailUrl = uploadResult.secure_url;
    }

    try {
      const updatedSermon = await this.prisma.sermon.update({
        where: { id },
        data: {
          title: dto.title,
          preacher: dto.preacher,
          scriptureText: dto.scriptureText,
          summary: dto.summary,
          sermonDate: dto.sermonDate ? new Date(dto.sermonDate) : undefined,
          audioUrl: dto.audioUrl,
          videoUrl: dto.videoUrl,
          thumbnailUrl,
        },
      });

      // Audit Log
      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.UPDATE_SERMON,
          entity: 'Sermon',
          entityId: updatedSermon.id,
          description: `Updated sermon record "${updatedSermon.title}"`,
          oldValues: before,
          newValues: updatedSermon,
        },
      );

      return updatedSermon;
    } catch (error) {
      this.logger.error(
        `Failed to update sermon ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not update sermon record.');
    }
  }

  /**
   * Soft-delete or hard-delete sermon record.
   */
  async remove(id: string): Promise<{ message: string }> {
    const sermon = await this.findOne(id);

    try {
      await this.prisma.sermon.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Audit Log
      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.DELETE_SERMON,
          entity: 'Sermon',
          entityId: id,
          description: `Soft deleted sermon "${sermon.title}"`,
          oldValues: sermon,
        },
      );

      return { message: 'Sermon successfully deleted.' };
    } catch (error) {
      this.logger.error(
        `Failed to delete sermon ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not delete sermon record.');
    }
  }
}