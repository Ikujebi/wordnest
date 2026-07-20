import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Adjust this path if your PrismaModule is located elsewhere

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService], // Exporting in case other modules need programmatic access to global search later
})
export class SearchModule {}