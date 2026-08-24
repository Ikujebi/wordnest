import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Sermon } from '@prisma/client';
import { UploadSermonDto } from './dto/upload-sermon.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
  ) {}

  async logSermon(dto: UploadSermonDto, uploaderId?: string): Promise<Sermon> {
    try {
      const sermon = await this.prisma.sermon.create({
        data: { ...dto, sermonDate: new Date(dto.sermonDate) },
      });

      await this.auditLogService.createLog(
        { id: uploaderId },
        {
          action: AuditAction.CREATE_SERMON,
          entity: 'Sermon',
          entityId: sermon.id,
          description: `Uploaded new sermon: ${sermon.title}`,
          newValues: sermon,
        },
      );

      await this.notificationsService.notifyEveryone({
        title: 'New Sermon Available',
        message: `Check out our latest sermon: "${sermon.title}" by ${sermon.preacher}`,
      });

      return sermon;
    } catch (error) {
      this.logger.error('Failed to index media sermon entry', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not persist media metadata details.');
    }
  }
}