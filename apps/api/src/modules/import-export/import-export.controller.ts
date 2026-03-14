import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ImportExportService } from './import-export.service';
import {
  ExportFormat,
  ImportSource,
  ExportDocumentDto,
  ExportBatchDto,
  ImportDocumentDto,
  BackupDto,
} from './dto/import-export.dto';

@ApiTags('导入导出')
@Controller('import-export')
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Get('documents/:id/export')
  @ApiOperation({ summary: '导出单个文档' })
  @ApiParam({ name: 'id', description: '文档 ID' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: ExportFormat = ExportFormat.MARKDOWN,
    @Query('includeMetadata') includeMetadata: boolean = true,
  ) {
    return this.importExportService.exportDocument(
      id,
      format,
      includeMetadata,
    );
  }

  @Post('documents/export-batch')
  @ApiOperation({ summary: '批量导出文档' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportBatch(@Body() dto: ExportBatchDto) {
    return this.importExportService.exportBatch(dto);
  }

  @Post('documents/import')
  @ApiOperation({ summary: '导入单个文档' })
  @ApiResponse({ status: 201, description: '导入成功' })
  async importDocument(@Body() dto: ImportDocumentDto) {
    return this.importExportService.importDocument(dto);
  }

  @Post('documents/import-file')
  @ApiOperation({ summary: '通过文件导入文档' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        source: { type: 'string', enum: Object.values(ImportSource) },
        folderId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('source') source: ImportSource,
    @Body('folderId') folderId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }

    const content = file.buffer.toString('utf-8');
    return this.importExportService.importDocument({
      source,
      content,
      filename: file.originalname,
      folderId,
    });
  }

  @Post('documents/import-batch')
  @ApiOperation({ summary: '批量导入文档' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 50))
  async importBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('source') source: ImportSource,
    @Body('folderId') folderId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请上传文件');
    }

    const fileData = files.map((file) => ({
      content: file.buffer.toString('utf-8'),
      filename: file.originalname,
    }));

    return this.importExportService.importBatch(
      fileData,
      source,
      folderId,
    );
  }

  @Post('backup')
  @ApiOperation({ summary: '创建数据备份' })
  @ApiResponse({ status: 200, description: '备份成功' })
  async createBackup(@Body() dto: BackupDto) {
    return this.importExportService.createBackup(dto);
  }

  @Post('restore')
  @ApiOperation({ summary: '从备份恢复数据' })
  @ApiResponse({ status: 200, description: '恢复成功' })
  async restoreBackup(@Body() backupData: any) {
    return this.importExportService.restoreBackup(backupData);
  }

  @Post('restore-file')
  @ApiOperation({ summary: '从备份文件恢复数据' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async restoreFromFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传备份文件');
    }

    const content = file.buffer.toString('utf-8');
    let backupData;

    try {
      backupData = JSON.parse(content);
    } catch (e) {
      throw new BadRequestException('无效的备份文件格式');
    }

    return this.importExportService.restoreBackup(backupData);
  }
}
