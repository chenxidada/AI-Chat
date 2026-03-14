import {
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { GetGraphDataDto } from './dto/graph.dto';

@ApiTags('知识图谱')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  @ApiOperation({ summary: '获取完整知识图谱数据' })
  @ApiQuery({ name: 'maxNodes', required: false, type: Number, description: '最大节点数' })
  @ApiQuery({ name: 'folderId', required: false, type: String, description: '文件夹ID筛选' })
  @ApiQuery({ name: 'tagId', required: false, type: String, description: '标签ID筛选' })
  @ApiResponse({ status: 200, description: '图谱数据' })
  async getFullGraph(@Query() dto: GetGraphDataDto) {
    return this.graphService.getFullGraph(dto);
  }

  @Get('document/:id')
  @ApiOperation({ summary: '获取以指定文档为中心的局部图谱' })
  @ApiParam({ name: 'id', description: '中心文档 ID' })
  @ApiQuery({ name: 'depth', required: false, type: Number, description: '扩展深度' })
  @ApiQuery({ name: 'maxNodes', required: false, type: Number, description: '最大节点数' })
  @ApiResponse({ status: 200, description: '局部图谱数据' })
  async getLocalGraph(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: GetGraphDataDto,
  ) {
    return this.graphService.getLocalGraph(id, dto);
  }

  @Get('document/:id/stats')
  @ApiOperation({ summary: '获取文档的连接统计' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiResponse({ status: 200, description: '连接统计' })
  async getDocumentStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.graphService.getDocumentStats(id);
  }

  @Get('hot')
  @ApiOperation({ summary: '获取热门连接文档' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '返回数量' })
  @ApiResponse({ status: 200, description: '热门文档列表' })
  async getHotDocuments(@Query('limit') limit: number = 10) {
    return this.graphService.getHotDocuments(limit);
  }
}
