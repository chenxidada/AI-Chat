import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('搜索')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: '全文搜索文档' })
  @ApiResponse({ status: 200, description: '搜索结果' })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Post('reindex')
  @ApiOperation({ summary: '全量重建 Meilisearch 索引' })
  @ApiResponse({ status: 201, description: '重建完成' })
  reindex() {
    return this.searchService.reindexAll();
  }
}
