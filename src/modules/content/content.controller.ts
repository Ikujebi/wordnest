import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { UploadSermonDto } from './dto/upload-sermon.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('sermons')
  @UseGuards(JwtAuthGuard)
  async catalogSermon(@Body() dto: UploadSermonDto) {
    return this.contentService.logSermon(dto);
  }

  @Post('articles')
  @UseGuards(JwtAuthGuard)
  async publishArticle(@Req() req: any, @Body() dto: CreatePostDto) {
    return this.contentService.createBlogPost(dto, req.user.id);
  }

  @Get('feed')
  async getPublicArticles() {
    return this.contentService.fetchPublicFeed();
  }
}