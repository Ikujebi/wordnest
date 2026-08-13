import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module'; // adjust to your actual email module path

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}