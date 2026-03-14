import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';

@ApiTags('双向链接')
@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get('documents/:id/links')
  @ApiOperation({ summary: '获取文档的出站链接' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getOutboundLinks(@Param('id', ParseUUIDPipe) id: string) {
    return this.linksService.getOutboundLinks(id);
  }

  @Get('documents/:id/backlinks')
  @ApiOperation({ summary: '获取文档的反向链接' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getBacklinks(@Param('id', ParseUUIDPipe) id: string) {
    return this.linksService.getBacklinks(id);
  }

  @Post('links')
  @ApiOperation({ summary: '创建链接' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(@Body() dto: CreateLinkDto) {
    return this.linksService.create(dto);
  }

  @Delete('links/:id')
  @ApiOperation({ summary: '删除链接' })
  @ApiParam({ name: 'id', description: '链接 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.linksService.remove(id);
  }

  @Get('links/suggest')
  @ApiOperation({ summary: '搜索文档标题（用于链接建议）' })
  async suggest(
    @Query('q') query: string,
    @Query('exclude') excludeId?: string,
  ) {
    return this.linksService.searchDocuments(query, excludeId);
  }
}
