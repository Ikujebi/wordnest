import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { EmailService } from '../email/email.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    AuditLogModule,
    forwardRef(() => AuthModule), // 👈 Use forwardRef here
  ],
  controllers: [
    UsersController,
  ],
  providers: [
    UsersService,
    EmailService,
  ],
  exports: [
    UsersService,
  ],
})
export class UsersModule {}