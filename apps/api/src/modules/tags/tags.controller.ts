import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@ApiTags('标签')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * 获取所有标签
   */
  @Get()
  @ApiOperation({ summary: '获取所有标签', description: '返回所有标签列表，按名称排序，含文档数量' })
  @ApiResponse({ status: 200, description: '标签列表' })
  findAll() {
    return this.tagsService.findAll();
  }

  /**
   * 创建标签
   */
  @Post()
  @ApiOperation({ summary: '创建标签', description: '创建新标签，若未指定颜色则随机分配预设颜色' })
  @ApiResponse({ status: 201, description: '标签创建成功' })
  @ApiResponse({ status: 409, description: '标签名称已存在' })
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  /**
   * 更新标签
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新标签', description: '更新指定标签的名称或颜色' })
  @ApiParam({ name: 'id', description: '标签 ID (UUID)', type: 'string' })
  @ApiResponse({ status: 200, description: '标签更新成功' })
  @ApiResponse({ status: 404, description: '标签不存在' })
  @ApiResponse({ status: 409, description: '标签名称已存在' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  /**
   * 删除标签
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除标签', description: '删除指定标签，关联的 DocumentTag 记录将级联删除' })
  @ApiParam({ name: 'id', description: '标签 ID (UUID)', type: 'string' })
  @ApiResponse({ status: 200, description: '标签删除成功' })
  @ApiResponse({ status: 404, description: '标签不存在' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagsService.remove(id);
  }

  /**
   * 获取标签下的文档（分页）
   */
  @Get(':id/documents')
  @ApiOperation({ summary: '获取标签下的文档', description: '分页获取指定标签关联的所有文档' })
  @ApiParam({ name: 'id', description: '标签 ID (UUID)', type: 'string' })
  @ApiQuery({ name: 'page', description: '页码（从 1 开始）', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: '每页数量', required: false, type: Number })
  @ApiResponse({ status: 200, description: '文档分页列表' })
  @ApiResponse({ status: 404, description: '标签不存在' })
  findDocumentsByTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.tagsService.findDocumentsByTag(id, page, limit);
  }
}
