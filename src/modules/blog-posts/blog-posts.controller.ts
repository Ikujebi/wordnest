import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { BlogPostsService } from './blog-posts.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogPostQueryDto } from './dto/blog-post-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BlogAccessGuard } from './guards/blog-access.guard';

@Controller('blog-posts')
export class BlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  @Get()
  findAll(@Query() query: BlogPostQueryDto) {
    return this.blogPostsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.blogPostsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Req() req: any, @Body() dto: CreateBlogPostDto) {
    return this.blogPostsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: UpdateBlogPostDto) {
    return this.blogPostsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.blogPostsService.remove(id, req.user.id);
  }
  @Post(':id/notify')
@UseGuards(JwtAuthGuard, BlogAccessGuard)
notifySubscribers(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
  return this.blogPostsService.notifySubscribers(id, req.user.id);
}
}