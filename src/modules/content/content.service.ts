// src/modules/content/content.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Sermon, BlogPost, Prisma } from '@prisma/client';
import { UploadSermonDto } from './dto/upload-sermon.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';
import slugify from 'slugify';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
  ) {}

  /**
   * Archives a new media sermon delivery into the catalog.
   */
  async logSermon(dto: UploadSermonDto, uploaderId?: string): Promise<Sermon> {
    try {
      const sermon = await this.prisma.sermon.create({
        data: {
          ...dto,
          sermonDate: new Date(dto.sermonDate),
        },
      });

      // 1. Audit Log
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

      // 2. Broadcast Notification to Everyone
      await this.notificationsService.notifyEveryone({
        title: 'New Sermon Available',
        message: `Check out our latest sermon: "${sermon.title}" by ${sermon.preacher}`,
      });

      return sermon;
    } catch (error) {
      this.logger.error(
        'Failed to index media sermon entry',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Could not persist media metadata details.',
      );
    }
  }

  /**
   * Compiles and creates a new blog post publication entry.
   */
  async createBlogPost(
    dto: CreatePostDto,
    authorId: string,
  ): Promise<BlogPost> {
    const slug = slugify(dto.title, { lower: true, strict: true });

    try {
      const post = await this.prisma.blogPost.create({
        data: {
          title: dto.title,
          slug,
          content: dto.content,
          excerpt: dto.excerpt || null,
          coverImage: dto.coverImage || null,
          isPublished: dto.isPublished || false,
          authorId,
          createdById: authorId,
          publishedAt: dto.isPublished ? new Date() : null,
        },
      });

      // 1. Audit Log
      await this.auditLogService.createLog(
        { id: authorId },
        {
          action: post.isPublished
            ? AuditAction.PUBLISH_BLOG_POST
            : AuditAction.CREATE_BLOG_POST,
          entity: 'BlogPost',
          entityId: post.id,
          description: `Created blog post: ${post.title}`,
          newValues: post,
        },
      );

      // 2. If published immediately, notify everyone
      if (post.isPublished) {
        await this.notificationsService.notifyEveryone({
          title: 'New Article Published',
          message: `Read our new blog post: "${post.title}"`,
        });
      }

      return post;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A publication record matching this generated title slug path already exists.',
        );
      }
      this.logger.error(
        'Failed compiling publication record data arrays',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Could not publish article matrix data structures.',
      );
    }
  }

  /**
   * Public data delivery engine retrieval query loop processing active public articles.
   */
  async fetchPublicFeed(): Promise<BlogPost[]> {
    return this.prisma.blogPost.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
      },
      include: {
        author: {
          select: { fullName: true, role: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }
}