import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Sermon, BlogPost, Prisma } from '@prisma/client';
import { UploadSermonDto } from './dto/upload-sermon.dto';
import { CreatePostDto } from './dto/create-post.dto';
import slugify from 'slugify';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Archives a new media sermon delivery into the catalog.
   */
  async logSermon(dto: UploadSermonDto): Promise<Sermon> {
    try {
      return await this.prisma.sermon.create({
        data: {
          ...dto,
          sermonDate: new Date(dto.sermonDate),
        },
      });
    } catch (error) {
      this.logger.error('Failed to index media sermon entry', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not persist media metadata details.');
    }
  }

  /**
   * Compiles and creates a new structural blog post publication entry under transactional safety.
   */
  async createBlogPost(dto: CreatePostDto, authorId: string): Promise<BlogPost> {
    const slug = slugify(dto.title, { lower: true, strict: true });

    try {
      return await this.prisma.blogPost.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A publication record matching this generated title slug path already exists.');
      }
      this.logger.error('Failed compiling publication record data arrays', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not publish article matrix data structures.');
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