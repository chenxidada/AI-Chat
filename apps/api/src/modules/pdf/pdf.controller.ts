import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseUUIDPipe,
  StreamableFile,
  Header,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { PdfService } from './pdf.service';
import { QueryPdfDto, UpdatePdfDto } from './dto/pdf.dto';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('PDF文件')
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('upload')
  @ApiOperation({ summary: '上传单个 PDF 文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '上传成功' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'uploads', 'pdfs'),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname) || '.pdf';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('仅支持 PDF 文件'), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentId') documentId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请上传 PDF 文件');
    }
    return this.pdfService.uploadPdf(file, documentId);
  }

  @Post('upload-batch')
  @ApiOperation({ summary: '批量上传 PDF 文件（最多10个）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        documentId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '批量上传成功' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'uploads', 'pdfs'),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname) || '.pdf';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('仅支持 PDF 文件'), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 10,
      },
    }),
  )
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentId') documentId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请上传至少一个 PDF 文件');
    }
    return this.pdfService.uploadBatch(files, documentId);
  }

  @Get()
  @ApiOperation({ summary: '获取 PDF 文件列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'documentId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String, description: '搜索PDF内容' })
  @ApiResponse({ status: 200, description: 'PDF 列表' })
  findAll(@Query() query: QueryPdfDto) {
    return this.pdfService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取 PDF 统计信息' })
  @ApiResponse({ status: 200, description: '统计信息' })
  getStats() {
    return this.pdfService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: '搜索 PDF 内容' })
  @ApiQuery({ name: 'q', required: true, type: String, description: '搜索关键词' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '搜索结果' })
  search(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.pdfService.searchContent(query, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取 PDF 详情' })
  @ApiParam({ name: 'id', description: 'PDF ID' })
  @ApiResponse({ status: 200, description: 'PDF 详情' })
  @ApiResponse({ status: 404, description: 'PDF 不存在' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pdfService.findOne(id);
  }

  @Get(':id/view')
  @ApiOperation({ summary: '在线浏览 PDF（返回文件流）' })
  @ApiParam({ name: 'id', description: 'PDF ID' })
  @ApiResponse({ status: 200, description: 'PDF 文件流' })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline')
  async viewPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filePath = await this.pdfService.getFilePath(id);
    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载 PDF 文件' })
  @ApiParam({ name: 'id', description: 'PDF ID' })
  @ApiResponse({ status: 200, description: 'PDF 文件下载' })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.pdfService.findOne(id);
    const filePath = await this.pdfService.getFilePath(id);
    const file = createReadStream(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(pdf.originalName)}"`,
    );

    return new StreamableFile(file);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新 PDF 信息' })
  @ApiParam({ name: 'id', description: 'PDF ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePdfDto,
  ) {
    return this.pdfService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除 PDF 文件' })
  @ApiParam({ name: 'id', description: 'PDF ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pdfService.remove(id);
  }
}
