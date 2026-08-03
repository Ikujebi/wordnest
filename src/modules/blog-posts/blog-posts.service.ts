import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, BlogPost } from '@prisma/client';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogPostQueryDto } from './dto/blog-post-query.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import slugify from 'slugify';

@Injectable()
export class BlogPostsService {
  private readonly logger = new Logger(BlogPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateBlogPostDto, authorId: string): Promise<BlogPost> {
    const slug = slugify(dto.title, { lower: true, strict: true });

    try {
      const post = await this.prisma.blogPost.create({
        data: {
          title: dto.title,
          slug,
          content: dto.content,
          excerpt: dto.excerpt ?? null,
          coverImage: dto.coverImage ?? null,
          isPublished: dto.isPublished ?? false,
          publishedAt: dto.isPublished ? new Date() : null,
          authorId,
          createdById: authorId,
        },
      });

      await this.auditLogService.createLog(
        { id: authorId },
        {
          action: AuditAction.CREATE_BLOG_POST,
          entity: 'BlogPost',
          entityId: post.id,
          description: `Blog post "${post.title}" was created.`,
          newValues: post,
        },
      );

      return post;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A blog post with this title already exists.');
      }
      this.logger.error('Failed to create blog post', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not create blog post.');
    }
  }

  async findAll(query: BlogPostQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BlogPostWhereInput = {
      deletedAt: null,
      ...(query.isPublished !== undefined ? { isPublished: query.isPublished === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { excerpt: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, fullName: true } } },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id, deletedAt: null },
      include: { author: { select: { id: true, fullName: true } } },
    });
    if (!post) throw new NotFoundException('Blog post not found.');
    return post;
  }

  async update(id: string, dto: UpdateBlogPostDto, adminId: string): Promise<BlogPost> {
    const existing = await this.findOne(id);

    const wasPublished = existing.isPublished;
    const willBePublished = dto.isPublished ?? existing.isPublished;

    try {
      const updated = await this.prisma.blogPost.update({
        where: { id },
        data: {
          ...dto,
          updatedById: adminId,
          // Set publishedAt the first time a post transitions draft -> published
          ...(willBePublished && !wasPublished ? { publishedAt: new Date() } : {}),
        },
      });

      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: willBePublished && !wasPublished ? AuditAction.PUBLISH_BLOG_POST : AuditAction.UPDATE_BLOG_POST,
          entity: 'BlogPost',
          entityId: id,
          description: `Blog post "${existing.title}" was ${willBePublished && !wasPublished ? 'published' : 'updated'}.`,
          oldValues: existing,
          newValues: updated,
        },
      );

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A blog post with this title already exists.');
      }
      throw new InternalServerErrorException('Could not update blog post.');
    }
  }

  async remove(id: string, adminId: string) {
    const existing = await this.findOne(id);

    const deleted = await this.prisma.blogPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: AuditAction.DELETE_BLOG_POST,
        entity: 'BlogPost',
        entityId: id,
        description: `Blog post "${existing.title}" was deleted.`,
        oldValues: existing,
        newValues: deleted,
      },
    );

    return { message: 'Blog post deleted successfully.' };
  }
}