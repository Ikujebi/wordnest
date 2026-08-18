import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module'; // adjust to your actual email module path
import { AuthModule } from '../../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module'; // 👈 Import AuditLogModule (adjust relative path as needed)

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    ConfigModule,
    AuthModule,
    AuditLogModule, // 👈 Register AuditLogModule here
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}