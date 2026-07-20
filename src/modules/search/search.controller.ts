import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async globalSearch(@Query('q') query: string) {
    if (!query) {
      return {
        members: [], events: [], sermons: [], media: [],
        departments: [], giving: [], admins: [], auditLogs: []
      };
    }
    return this.searchService.executeGlobalSearch(query);
  }
}