import { Module } from '@nestjs/common';
import { BlogPostsController } from './blog-posts.controller';
import { BlogPostsService } from './blog-posts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CommunicationsModule } from '../communications/communications.module';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';


@Module({
  imports: [PrismaModule, AuditLogModule, CommunicationsModule, CloudinaryModule],
  controllers: [BlogPostsController],
  providers: [BlogPostsService],
  exports: [BlogPostsService],
})
export class BlogPostsModule {}