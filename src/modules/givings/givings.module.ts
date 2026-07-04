import { Module } from '@nestjs/common';
import { GivingsService } from './givings.service';
import { GivingsController } from './givings.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GivingsController],
  providers: [GivingsService],
  exports: [GivingsService],
})
export class GivingsModule {}