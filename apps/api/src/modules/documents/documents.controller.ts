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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { DocumentsBatchService } from './documents-batch.service';
import { OutlineService } from './outline.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { BatchMoveDto } from './dto/batch-move.dto';
import { BatchTagDto } from './dto/batch-tag.dto';
import { BatchOperationDto } from './dto/batch-operation.dto';

@ApiTags('文档')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentsBatchService: DocumentsBatchService,
    private readonly outlineService: OutlineService,
  ) {}

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

  @Get('favorites')
  @ApiOperation({ summary: '获取收藏的文档列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '收藏文档列表' })
  findFavorites(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.documentsService.findFavorites({ page, limit });
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

  @Get(':id/outline')
  @ApiOperation({ summary: '获取文档目录大纲' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文档大纲' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async getOutline(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.documentsService.findOne(id);
    return this.outlineService.extractOutline(doc.content);
  }

  @Post()
  @ApiOperation({ summary: '创建文档' })
  @ApiResponse({ status: 201, description: '文档创建成功' })
  create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: '复制文档' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 201, description: '文档复制成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.duplicate(id);
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

  @Patch(':id/favorite')
  @ApiOperation({ summary: '切换文档收藏状态' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '收藏状态已切换' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  toggleFavorite(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.toggleFavorite(id);
  }

  @Patch(':id/pin')
  @ApiOperation({ summary: '切换文档置顶状态' })
  @ApiParam({ name: 'id', description: '文档 ID (UUID)' })
  @ApiResponse({ status: 200, description: '置顶状态已切换' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  togglePin(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.togglePin(id);
  }

  // ─── 批量操作端点 ──────────────────────────────────────────────────────────────

  @Post('batch-move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量移动文档' })
  @ApiResponse({ status: 200, description: '移动成功' })
  batchMove(@Body() dto: BatchMoveDto) {
    return this.documentsBatchService.batchMove(dto);
  }

  @Post('batch-tag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量标签操作' })
  @ApiResponse({ status: 200, description: '操作成功' })
  batchTag(@Body() dto: BatchTagDto) {
    return this.documentsBatchService.batchTag(dto);
  }

  @Post('batch-archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量归档文档' })
  @ApiResponse({ status: 200, description: '归档成功' })
  batchArchive(@Body() dto: BatchOperationDto) {
    return this.documentsBatchService.batchArchive(dto.documentIds);
  }

  @Post('batch-restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量恢复文档' })
  @ApiResponse({ status: 200, description: '恢复成功' })
  batchRestore(@Body() dto: BatchOperationDto) {
    return this.documentsBatchService.batchRestore(dto.documentIds);
  }

  @Post('batch-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量永久删除文档' })
  @ApiResponse({ status: 200, description: '删除成功' })
  batchDelete(@Body() dto: BatchOperationDto) {
    return this.documentsBatchService.batchDelete(dto.documentIds);
  }
}
