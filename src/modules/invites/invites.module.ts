import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module'; // adjust to your actual email module path

@Module({
  imports: [PrismaModule, EmailModule, ConfigModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}