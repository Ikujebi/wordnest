import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

import { NotificationsService } from './services/notifications.service';

@Global()
@Module({
  imports: [PrismaModule, ConfigModule],

  providers: [
    NotificationsService,
  ],

  exports: [
    NotificationsService,
  ],
})
export class CommonModule {}