import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { WebAnalyticsController } from './web-analytics.controller';
import { WebAnalyticsService } from './web-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [WebAnalyticsController],
  providers: [WebAnalyticsService],
  exports: [WebAnalyticsService],
})
export class WebAnalyticsModule {}