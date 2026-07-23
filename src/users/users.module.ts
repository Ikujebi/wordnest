import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module'; // 👈 Import AuditLogModule

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    AuditLogModule, // 👈 Registered here so AuditInterceptor can access AuditLogService
  ],
  controllers: [
    UsersController,
  ],
  providers: [
    UsersService,
  ],
  exports: [
    UsersService,
  ],
})
export class UsersModule {}