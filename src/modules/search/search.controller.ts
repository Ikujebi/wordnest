import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('search') // was 'api/search' — duplicates the global /api prefix, causing /api/api/search
@UseGuards(JwtAuthGuard) // was completely unguarded — anyone could hit financial/giving search results
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async globalSearch(@Query('q') query: string, @Req() req: any) {
    if (!query) {
      return {
        members: [], events: [], sermons: [], media: [],
        departments: [], giving: [], admins: [], auditLogs: [],
      };
    }
    return this.searchService.executeGlobalSearch(query, req.user?.role);
  }
}