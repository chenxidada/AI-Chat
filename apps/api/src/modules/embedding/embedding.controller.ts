import { Controller, Post, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmbeddingSyncService } from './embedding-sync.service';

@ApiTags('向量化')
@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly syncService: EmbeddingSyncService) {}

  @Post('sync/:documentId')
  @ApiOperation({ summary: '同步单个文档的向量' })
  @ApiResponse({ status: 200, description: '同步状态' })
  async syncDocument(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.syncService.syncDocument(documentId);
  }

  @Post('sync-all')
  @ApiOperation({ summary: '同步所有文档的向量' })
  @ApiResponse({ status: 200, description: '同步结果' })
  async syncAll() {
    return this.syncService.syncAll();
  }

  @Get('status/:documentId')
  @ApiOperation({ summary: '获取文档同步状态' })
  @ApiResponse({ status: 200, description: '同步状态' })
  getStatus(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.syncService.getSyncStatus(documentId) || { status: 'not_found' };
  }
}
