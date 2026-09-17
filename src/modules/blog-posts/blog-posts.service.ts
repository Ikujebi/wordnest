import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, BlogPost } from '@prisma/client';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogPostQueryDto } from './dto/blog-post-query.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import slugify from 'slugify';
import { RecipientService } from '../communications/services/recipient.service';
import { BroadcastService } from '../communications/services/broadcast.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

type BlogPostWithNotifyStatus = BlogPost & { notified?: boolean; notifyError?: string };

@Injectable()
export class BlogPostsService {
  private readonly logger = new Logger(BlogPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly recipientService: RecipientService,
    private readonly broadcastService: BroadcastService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateBlogPostDto, authorId: string): Promise<BlogPostWithNotifyStatus> {
    const slug = slugify(dto.title, { lower: true, strict: true });

    let post: BlogPost;
    try {
      post = await this.prisma.blogPost.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A blog post with this title already exists.');
      }
      this.logger.error('Failed to create blog post', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not create blog post.');
    }

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

    // A post created directly as Published gets the same auto-notify
    // treatment as one published later via an edit — see the identical
    // block in update() for the reasoning.
    if (post.isPublished) {
      return this.notifyAfterPublish(post, authorId);
    }

    return post;
  }

  async update(id: string, dto: UpdateBlogPostDto, adminId: string): Promise<BlogPostWithNotifyStatus> {
    const existing = await this.findOne(id);

    const wasPublished = existing.isPublished;
    const willBePublished = dto.isPublished ?? existing.isPublished;
    const isNewlyPublished = willBePublished && !wasPublished;

    let updated: BlogPost;
    try {
      updated = await this.prisma.blogPost.update({
        where: { id },
        data: {
          ...dto,
          updatedById: adminId,
          // Set publishedAt the first time a post transitions draft -> published
          ...(isNewlyPublished ? { publishedAt: new Date() } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A blog post with this title already exists.');
      }
      throw new InternalServerErrorException('Could not update blog post.');
    }

    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: isNewlyPublished ? AuditAction.PUBLISH_BLOG_POST : AuditAction.UPDATE_BLOG_POST,
        entity: 'BlogPost',
        entityId: id,
        description: `Blog post "${existing.title}" was ${isNewlyPublished ? 'published' : 'updated'}.`,
        oldValues: existing,
        newValues: updated,
      },
    );

    if (isNewlyPublished) {
      return this.notifyAfterPublish(updated, adminId);
    }

    return updated;
  }

  /**
   * Fires the subscriber notification immediately after a post transitions
   * to published — whether that happens at creation or via a later edit.
   * Isolated in its own try/catch so an email failure (bad Resend config,
   * network blip) never rolls back or fails the publish itself: the post
   * stays live either way, and the caller gets a `notified` flag to show
   * the admin whether the email actually went out.
   */
  private async notifyAfterPublish(post: BlogPost, performingUserId: string): Promise<BlogPostWithNotifyStatus> {
    try {
      await this.notifySubscribers(post.id, performingUserId);
      return { ...post, notified: true };
    } catch (error) {
      this.logger.error(
        `Post "${post.title}" published, but auto-notify to subscribers failed.`,
        error instanceof Error ? error.stack : String(error),
      );
      return {
        ...post,
        notified: false,
        notifyError: error instanceof Error ? error.message : 'Failed to notify subscribers.',
      };
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

  async notifySubscribers(id: string, performingUserId: string) {
  const post = await this.findOne(id);
  if (!post.isPublished) {
    throw new BadRequestException('Only published posts can be sent to subscribers.');
  }

  const recipients = await this.recipientService.resolveRecipients({ type: 'ALL_MEMBERS_AND_SUBSCRIBERS' });
  const unique = this.recipientService.removeDuplicates(recipients);

  const blogUrl = `https://www.wordtabernacle.org.ng/blog/${post.slug}`;
  
  // Clean raw HTML tags and truncate cleanly at whole words
  const rawExcerpt = (post.excerpt || post.content)
    .replace(/<[^>]*>?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  const previewSnippet = rawExcerpt.length > 220 
    ? `${rawExcerpt.slice(0, 220).replace(/\s+\S*$/, '')}...`
    : rawExcerpt;

  const currentYear = new Date().getFullYear();

  // Bulletproof Cover Image HTML for Outlook and Modern Clients
  const coverImageHtml = post.coverImage
    ? `
      <tr>
        <td align="center" style="padding:0 0 24px 0;margin:0;">
          <a href="${blogUrl}" target="_blank" style="text-decoration:none;display:block;">
            <img 
              src="${post.coverImage}" 
              alt="${post.title}" 
              width="550" 
              style="display:block;width:100%;max-width:550px;height:auto;max-height:280px;object-fit:cover;border:0;outline:none;text-decoration:none;border-radius:8px;" 
            />
          </a>
        </td>
      </tr>
    `
    : '';

  // World-Class Responsive Email HTML Template
  const contentHtml = `
    <!DOCTYPE html>
    <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>${post.title}</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
      <style>
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f5f7; }
      </style>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      
      <!-- Preheader snippet for inbox preview -->
      <div style="display:none;font-size:1px;color:#f4f5f7;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${previewSnippet}
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:#f4f5f7;table-layout:fixed;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            
            <!-- Main Email Box -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
              
              <!-- Header Section -->
              <tr>
                <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #f3f4f6;" align="left">
                  <span style="font-size:11px;font-weight:800;letter-spacing:0.15em;color:#5f021f;text-transform:uppercase;display:block;margin-bottom:4px;">
                    WORD TABERNACLE
                  </span>
                  <span style="font-size:12px;color:#6b7280;font-weight:500;">
                    Official Publication
                  </span>
                </td>
              </tr>

              <!-- Content Section -->
              <tr>
                <td style="padding:28px 32px 32px 32px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    
                    ${coverImageHtml}

                    <!-- Article Tag & Title -->
                    <tr>
                      <td style="padding:0 0 12px 0;">
                        <h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:700;color:#111827;letter-spacing:-0.01em;">
                          ${post.title}
                        </h1>
                      </td>
                    </tr>

                    <!-- Body Preview Text -->
                    <tr>
                      <td style="padding:0 0 28px 0;">
                        <p style="margin:0;font-size:15px;line-height:1.65;color:#4b5563;font-weight:400;">
                          ${previewSnippet}
                        </p>
                      </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                      <td align="left" style="padding:0 0 8px 0;">
                        <!--[if mso]>
                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${blogUrl}" style="height:44px;v-text-anchor:middle;width:180px;" arcsize="18%" stroke="f" fillcolor="#5f021f">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Read Full Article</center>
                        </v:roundrect>
                        <![endif]-->
                        <!--[if !mso]><!-->
                        <a href="${blogUrl}" target="_blank" style="display:inline-block;background-color:#5f021f;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;text-align:center;">
                          Read Full Article &rarr;
                        </a>
                        <!--<![endif]-->
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>

              <!-- Footer Section -->
              <tr>
                <td style="background-color:#fafafa;padding:24px 32px;border-top:1px solid #f3f4f6;text-align:center;">
                  <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;line-height:1.5;">
                    You are receiving this email because you are a registered member or subscriber of <strong>Word Tabernacle Bible Church</strong>.
                  </p>
                  <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.4;">
                    &copy; ${currentYear} Word Tabernacle. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const communication = await this.prisma.communication.create({
    data: {
      title: `New Blog Post: ${post.title}`,
      subject: post.title,
      content: contentHtml,
      type: 'BLOG_POST',
      status: 'DRAFT',
      channels: ['EMAIL'],
      imageUrls: post.coverImage ? [post.coverImage] : [],
      createdById: performingUserId,
    },
  });

  await this.recipientService.attachRecipients(communication.id, unique);
  const result = await this.broadcastService.send(communication.id);

  await this.auditLogService.createLog(
    { id: performingUserId },
    {
      action: AuditAction.SEND_COMMUNICATION,
      entity: 'BlogPost',
      entityId: id,
      description: `Notified ${unique.length} recipients about blog post "${post.title}"`,
      metadata: result,
    },
  );

  return result;
}

  async findBySlug(slug: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, deletedAt: null, isPublished: true },
      include: { author: { select: { id: true, fullName: true } } },
    });
    if (!post) throw new NotFoundException('Blog post not found.');
    return post;
  }

  async uploadCoverImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const uploaded = await this.cloudinaryService.uploadFile(file, {
      folder: 'blog-covers',
    });

    return { url: uploaded.secure_url, publicId: uploaded.public_id };
  }
}