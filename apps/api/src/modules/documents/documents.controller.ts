import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';

@ApiTags('文档')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // 注意：静态路由放在动态路由 :id 之前

  @Get('recent')
  @ApiOperation({ summary: '获取最近更新的文档' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '返回数量' })
  @ApiResponse({ status: 200, description: '最近文档列表' })
  findRecent(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.documentsService.findRecent(limit);
  }

  @Get()
  @ApiOperation({ summary: '获取文档列表（分页、筛选、排序）' })
  @ApiResponse({ status: 200, description: '文档分页列表' })
  findAll(@Query() query: QueryDocumentDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文档详情' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文档详情' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建文档' })
  @ApiResponse({ status: 201, description: '文档创建成功' })
  create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新文档' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文档更新成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '永久删除文档' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文档已永久删除' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  removePermanent(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.removePermanent(id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: '切换文档归档状态' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '归档状态已切换' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.archive(id);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '移动文档到指定文件夹' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文档已移动' })
  @ApiResponse({ status: 404, description: '文档或文件夹不存在' })
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('folderId') folderId: string | null,
  ) {
    return this.documentsService.move(id, folderId);
  }
}
