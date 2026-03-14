# Phase 3-4 Spec: 文件导入 + 优化

## 1. 目标

实现多格式文件导入、文档导出、数据备份恢复，以及交互体验优化功能。完成后：

- 支持 .md/.txt/.html/.docx 格式导入
- 支持批量文件导入
- 文档导出为 Markdown/HTML/ZIP
- 数据完整备份和恢复
- 快捷键支持
- 自动保存状态显示

---

## 2. 前置条件

- [x] Phase 1 完成（文档 CRUD）
- [x] Phase 2 完成（AI 对话）
- [x] 图片上传功能可用

---

## 3. 后端实现

### 3.1 目录结构

```
apps/api/src/modules/
├── import/
│   ├── import.module.ts
│   ├── import.service.ts
│   ├── import.controller.ts
│   └── parsers/
│       ├── parser.interface.ts
│       ├── md.parser.ts
│       ├── txt.parser.ts
│       ├── html.parser.ts
│       └── docx.parser.ts
├── export/
│   ├── export.module.ts
│   ├── export.service.ts
│   └── export.controller.ts
└── backup/
    ├── backup.module.ts
    ├── backup.service.ts
    └── backup.controller.ts
```

### 3.2 导入服务

```typescript
// apps/api/src/modules/import/parsers/parser.interface.ts

export interface ParseResult {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface FileParser {
  parse(buffer: Buffer, filename: string): Promise<ParseResult>;
  supportedExtensions: string[];
}
```

```typescript
// apps/api/src/modules/import/parsers/md.parser.ts

import { Injectable } from '@nestjs/common';
import { FileParser, ParseResult } from './parser.interface';

@Injectable()
export class MdParser implements FileParser {
  supportedExtensions = ['.md', '.markdown'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const content = buffer.toString('utf-8');

    // 从文件名或第一个标题提取标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].trim()
      : filename.replace(/\.(md|markdown)$/i, '');

    return {
      title,
      content,
      metadata: {
        sourceType: 'import',
        originalFormat: 'markdown',
      },
    };
  }
}
```

```typescript
// apps/api/src/modules/import/parsers/txt.parser.ts

import { Injectable } from '@nestjs/common';
import { FileParser, ParseResult } from './parser.interface';

@Injectable()
export class TxtParser implements FileParser {
  supportedExtensions = ['.txt'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const content = buffer.toString('utf-8');
    const title = filename.replace(/\.txt$/i, '');

    return {
      title,
      content,
      metadata: {
        sourceType: 'import',
        originalFormat: 'text',
      },
    };
  }
}
```

```typescript
// apps/api/src/modules/import/parsers/html.parser.ts

import { Injectable } from '@nestjs/common';
import { FileParser, ParseResult } from './parser.interface';

@Injectable()
export class HtmlParser implements FileParser {
  supportedExtensions = ['.html', '.htm'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const html = buffer.toString('utf-8');

    // 提取标题
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].trim()
      : filename.replace(/\.(html|htm)$/i, '');

    // 简单的 HTML 转 Markdown
    let content = html
      // 移除 script 和 style
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // 标题
      .replace(/<h1[^>]*>([^<]*)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>([^<]*)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>([^<]*)<\/h3>/gi, '### $1\n')
      .replace(/<h4[^>]*>([^<]*)<\/h4>/gi, '#### $1\n')
      .replace(/<h5[^>]*>([^<]*)<\/h5>/gi, '##### $1\n')
      .replace(/<h6[^>]*>([^<]*)<\/h6>/gi, '###### $1\n')
      // 段落
      .replace(/<p[^>]*>([^<]*)<\/p>/gi, '$1\n\n')
      // 链接
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)')
      // 粗体
      .replace(/<(strong|b)[^>]*>([^<]*)<\/(strong|b)>/gi, '**$2**')
      // 斜体
      .replace(/<(em|i)[^>]*>([^<]*)<\/(em|i)>/gi, '*$2*')
      // 列表
      .replace(/<li[^>]*>([^<]*)<\/li>/gi, '- $1\n')
      // 换行
      .replace(/<br\s*\/?>/gi, '\n')
      // 移除其他标签
      .replace(/<[^>]+>/g, '')
      // 清理多余空白
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      title,
      content,
      metadata: {
        sourceType: 'import',
        originalFormat: 'html',
      },
    };
  }
}
```

```typescript
// apps/api/src/modules/import/parsers/docx.parser.ts

import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';
import { FileParser, ParseResult } from './parser.interface';

@Injectable()
export class DocxParser implements FileParser {
  private readonly logger = new Logger(DocxParser.name);
  supportedExtensions = ['.docx'];

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const title = filename.replace(/\.docx$/i, '');

      return {
        title,
        content: result.value,
        metadata: {
          sourceType: 'import',
          originalFormat: 'docx',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to parse docx: ${error.message}`);
      throw new Error(`无法解析 DOCX 文件: ${error.message}`);
    }
  }
}
```

```typescript
// apps/api/src/modules/import/import.service.ts

import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MdParser } from './parsers/md.parser';
import { TxtParser } from './parsers/txt.parser';
import { HtmlParser } from './parsers/html.parser';
import { DocxParser } from './parsers/docx.parser';
import { FileParser, ParseResult } from './parsers/parser.interface';
import { extname } from 'path';

export interface ImportResult {
  success: boolean;
  documentId?: string;
  title?: string;
  error?: string;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly parsers: Map<string, FileParser>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mdParser: MdParser,
    private readonly txtParser: TxtParser,
    private readonly htmlParser: HtmlParser,
    private readonly docxParser: DocxParser,
  ) {
    this.parsers = new Map();
    this.registerParser(mdParser);
    this.registerParser(txtParser);
    this.registerParser(htmlParser);
    this.registerParser(docxParser);
  }

  private registerParser(parser: FileParser) {
    for (const ext of parser.supportedExtensions) {
      this.parsers.set(ext.toLowerCase(), parser);
    }
  }

  /**
   * 获取支持的文件格式
   */
  getSupportedFormats(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * 解析单个文件
   */
  async parseFile(
    buffer: Buffer,
    filename: string,
  ): Promise<ParseResult> {
    const ext = extname(filename).toLowerCase();

    const parser = this.parsers.get(ext);
    if (!parser) {
      throw new BadRequestException(
        `不支持的文件格式: ${ext}。支持的格式: ${this.getSupportedFormats().join(', ')}`,
      );
    }

    return parser.parse(buffer, filename);
  }

  /**
   * 导入单个文件
   */
  async importFile(
    buffer: Buffer,
    filename: string,
    folderId?: string,
  ): Promise<ImportResult> {
    try {
      const parsed = await this.parseFile(buffer, filename);

      // 提取纯文本
      const contentPlain = this.extractPlainText(parsed.content);
      const wordCount = this.countWords(contentPlain);

      const document = await this.prisma.document.create({
        data: {
          title: parsed.title,
          content: parsed.content,
          contentPlain,
          wordCount,
          folderId: folderId || null,
          sourceType: 'import',
          metadata: parsed.metadata || {},
        },
      });

      return {
        success: true,
        documentId: document.id,
        title: document.title,
      };
    } catch (error) {
      this.logger.error(`Import failed for ${filename}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量导入文件
   */
  async importBatch(
    files: Array<{ buffer: Buffer; filename: string }>,
    folderId?: string,
  ): Promise<ImportResult[]> {
    const results: ImportResult[] = [];

    for (const file of files) {
      const result = await this.importFile(file.buffer, file.filename, folderId);
      results.push(result);
    }

    return results;
  }

  /**
   * 提取纯文本
   */
  private extractPlainText(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[*_~]+/g, '')
      .replace(/>\s/g, '')
      .replace(/[-*+]\s/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  /**
   * 统计字数
   */
  private countWords(text: string): number {
    const chinese = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    const english = text.replace(/[\u4e00-\u9fa5]/g, '').match(/\b\w+\b/g)?.length || 0;
    return chinese + english;
  }
}
```

### 3.3 导出服务

```typescript
// apps/api/src/modules/export/export.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import archiver from 'archiver';
import { Readable } from 'stream';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 导出单个文档为 Markdown
   */
  async exportMarkdown(documentId: string): Promise<{ content: string; filename: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${documentId} 不存在`);
    }

    const filename = this.sanitizeFilename(doc.title) + '.md';

    // 添加元数据注释
    const content = `---
title: ${doc.title}
created: ${doc.createdAt.toISOString()}
updated: ${doc.updatedAt.toISOString()}
---

${doc.content}`;

    return { content, filename };
  }

  /**
   * 导出单个文档为 HTML
   */
  async exportHtml(documentId: string): Promise<{ content: string; filename: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${documentId} 不存在`);
    }

    const filename = this.sanitizeFilename(doc.title) + '.html';

    // 简单的 Markdown 转 HTML（实际项目中可使用 marked 等库）
    const htmlContent = this.markdownToHtml(doc.content);

    const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1em; color: #666; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <p><small>创建于: ${doc.createdAt.toLocaleString('zh-CN')}</small></p>
  ${htmlContent}
</body>
</html>`;

    return { content, filename };
  }

  /**
   * 批量导出为 ZIP
   */
  async exportBatch(
    documentIds: string[],
    format: 'md' | 'html' = 'md',
  ): Promise<Readable> {
    const archive = archiver('zip', { zlib: { level: 9 } });

    for (const id of documentIds) {
      try {
        const result =
          format === 'md'
            ? await this.exportMarkdown(id)
            : await this.exportHtml(id);

        archive.append(result.content, { name: result.filename });
      } catch (error) {
        this.logger.warn(`Failed to export document ${id}: ${error.message}`);
      }
    }

    archive.finalize();
    return archive;
  }

  /**
   * 简单的 Markdown 转 HTML
   */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  /**
   * 清理文件名
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100);
  }
}
```

### 3.4 备份服务

```typescript
// apps/api/src/modules/backup/backup.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 导出全部数据
   */
  async exportAll(): Promise<{
    version: string;
    exportedAt: string;
    data: {
      folders: any[];
      documents: any[];
      tags: any[];
      documentTags: any[];
      conversations: any[];
      messages: any[];
      templates: any[];
    };
  }> {
    const [
      folders,
      documents,
      tags,
      documentTags,
      conversations,
      messages,
      templates,
    ] = await Promise.all([
      this.prisma.folder.findMany(),
      this.prisma.document.findMany(),
      this.prisma.tag.findMany(),
      this.prisma.documentTag.findMany(),
      this.prisma.conversation.findMany(),
      this.prisma.message.findMany(),
      this.prisma.documentTemplate.findMany(),
    ]);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        folders,
        documents,
        tags,
        documentTags,
        conversations,
        messages,
        templates,
      },
    };
  }

  /**
   * 导入备份数据
   */
  async importBackup(backup: {
    version: string;
    data: {
      folders?: any[];
      documents?: any[];
      tags?: any[];
      documentTags?: any[];
      conversations?: any[];
      messages?: any[];
      templates?: any[];
    };
  }): Promise<{
    success: boolean;
    imported: {
      folders: number;
      documents: number;
      tags: number;
      conversations: number;
      templates: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const imported = {
      folders: 0,
      documents: 0,
      tags: 0,
      conversations: 0,
      templates: 0,
    };

    try {
      // 使用事务导入
      await this.prisma.$transaction(async (tx) => {
        // 导入标签
        if (backup.data.tags) {
          for (const tag of backup.data.tags) {
            try {
              await tx.tag.create({ data: tag });
              imported.tags++;
            } catch (e) {
              errors.push(`Tag ${tag.id}: ${e.message}`);
            }
          }
        }

        // 导入文件夹
        if (backup.data.folders) {
          // 按层级排序导入
          const sorted = this.sortFoldersByHierarchy(backup.data.folders);
          for (const folder of sorted) {
            try {
              await tx.folder.create({ data: folder });
              imported.folders++;
            } catch (e) {
              errors.push(`Folder ${folder.id}: ${e.message}`);
            }
          }
        }

        // 导入文档
        if (backup.data.documents) {
          for (const doc of backup.data.documents) {
            try {
              await tx.document.create({ data: doc });
              imported.documents++;
            } catch (e) {
              errors.push(`Document ${doc.id}: ${e.message}`);
            }
          }
        }

        // 导入文档标签关联
        if (backup.data.documentTags) {
          for (const dt of backup.data.documentTags) {
            try {
              await tx.documentTag.create({ data: dt });
            } catch (e) {
              // 忽略关联错误
            }
          }
        }

        // 导入对话
        if (backup.data.conversations) {
          for (const conv of backup.data.conversations) {
            try {
              await tx.conversation.create({ data: conv });
              imported.conversations++;
            } catch (e) {
              errors.push(`Conversation ${conv.id}: ${e.message}`);
            }
          }
        }

        // 导入消息
        if (backup.data.messages) {
          for (const msg of backup.data.messages) {
            try {
              await tx.message.create({ data: msg });
            } catch (e) {
              // 忽略消息错误
            }
          }
        }

        // 导入模板
        if (backup.data.templates) {
          for (const template of backup.data.templates) {
            try {
              await tx.documentTemplate.create({ data: template });
              imported.templates++;
            } catch (e) {
              errors.push(`Template ${template.id}: ${e.message}`);
            }
          }
        }
      });

      return { success: true, imported, errors };
    } catch (error) {
      this.logger.error('Import failed', error);
      return { success: false, imported, errors: [error.message] };
    }
  }

  /**
   * 按层级排序文件夹（确保父文件夹先导入）
   */
  private sortFoldersByHierarchy(folders: any[]): any[] {
    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const sorted: any[] = [];
    const visited = new Set<string>();

    const visit = (folder: any) => {
      if (visited.has(folder.id)) return;
      visited.add(folder.id);

      if (folder.parentId && folderMap.has(folder.parentId)) {
        visit(folderMap.get(folder.parentId));
      }

      sorted.push(folder);
    };

    for (const folder of folders) {
      visit(folder);
    }

    return sorted;
  }
}
```

### 3.5 控制器

```typescript
// apps/api/src/modules/import/import.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { ImportService } from './import.service';

@ApiTags('文件导入')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('formats')
  @ApiOperation({ summary: '获取支持的文件格式' })
  getSupportedFormats() {
    return { formats: this.importService.getSupportedFormats() };
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传并导入文件' })
  @ApiResponse({ status: 201, description: '导入成功' })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'files', maxCount: 20 }]),
  )
  async uploadFiles(
    @UploadedFiles() files: { files: Express.Multer.File[] },
    @Query('folderId') folderId?: string,
  ) {
    const results = await this.importService.importBatch(
      files.files.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
      })),
      folderId,
    );

    return {
      total: results.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}
```

```typescript
// apps/api/src/modules/export/export.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';

@ApiTags('文档导出')
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('document/:id')
  @ApiOperation({ summary: '导出单个文档' })
  async exportDocument(
    @Param('id') id: string,
    @Query('format') format: 'md' | 'html' = 'md',
    @Res() res: Response,
  ) {
    const result =
      format === 'md'
        ? await this.exportService.exportMarkdown(id)
        : await this.exportService.exportHtml(id);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.send(result.content);
  }

  @Post('documents')
  @ApiOperation({ summary: '批量导出文档为 ZIP' })
  async exportDocuments(
    @Body() body: { documentIds: string[] },
    @Query('format') format: 'md' | 'html' = 'md',
    @Res() res: Response,
  ) {
    const stream = await this.exportService.exportBatch(
      body.documentIds,
      format,
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="documents-export.zip"`,
    );
    stream.pipe(res);
  }
}
```

```typescript
// apps/api/src/modules/backup/backup.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupService } from './backup.service';

@ApiTags('数据备份')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  @ApiOperation({ summary: '导出全部数据' })
  async exportAll(@Res() res: Response) {
    const backup = await this.backupService.exportAll();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="knowledge-base-backup-${new Date().toISOString().split('T')[0]}.json"`,
    );
    res.json(backup);
  }

  @Post('import')
  @ApiOperation({ summary: '导入备份数据' })
  @ApiResponse({ status: 200, description: '导入成功' })
  async importBackup(@Body() backup: any) {
    return this.backupService.importBackup(backup);
  }
}
```

### 3.6 模块注册

```typescript
// apps/api/src/modules/import/import.module.ts

import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { MdParser } from './parsers/md.parser';
import { TxtParser } from './parsers/txt.parser';
import { HtmlParser } from './parsers/html.parser';
import { DocxParser } from './parsers/docx.parser';

@Module({
  providers: [ImportService, MdParser, TxtParser, HtmlParser, DocxParser],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
```

---

## 4. 前端实现

### 4.1 安装依赖

```bash
cd apps/web
pnpm add react-dropzone file-saver jszip react-hotkeys-hook
pnpm add -D @types/file-saver
```

### 4.2 目录结构

```
apps/web/
├── components/import/
│   ├── file-uploader.tsx          # 文件上传组件
│   ├── import-dialog.tsx          # 导入对话框
│   └── import-progress.tsx        # 导入进度
├── components/backup/
│   ├── backup-dialog.tsx          # 备份对话框
│   └── restore-dialog.tsx         # 恢复对话框
├── components/documents/
│   └── save-status.tsx            # 保存状态组件
└── hooks/
    ├── use-import.ts              # 导入 Hook
    ├── use-export.ts              # 导出 Hook
    └── use-keyboard-shortcuts.ts  # 快捷键 Hook
```

### 4.3 文件上传组件

```typescript
// apps/web/components/import/file-uploader.tsx

'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  disabled?: boolean;
}

export function FileUploader({
  onFilesSelected,
  accept = {
    'text/markdown': ['.md', '.markdown'],
    'text/plain': ['.txt'],
    'text/html': ['.html', '.htm'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  },
  maxFiles = 20,
  disabled = false,
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesSelected(acceptedFiles);
    },
    [onFilesSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <input {...getInputProps()} />
      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      {isDragActive ? (
        <p className="text-primary">释放文件开始导入...</p>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground">
            拖拽文件到此处，或点击选择文件
          </p>
          <p className="text-xs text-muted-foreground">
            支持 .md, .txt, .html, .docx 格式，最多 {maxFiles} 个文件
          </p>
        </div>
      )}
    </div>
  );
}
```

### 4.4 导入对话框

```typescript
// apps/web/components/import/import-dialog.tsx

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileUploader } from './file-uploader';
import { ImportProgress } from './import-progress';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onSuccess?: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    success: boolean;
    documentId?: string;
    title?: string;
    error?: string;
  }>;
}

export function ImportDialog({
  open,
  onOpenChange,
  folderId,
  onSuccess,
}: ImportDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const params = folderId ? `?folderId=${folderId}` : '';
      const response = await apiClient.post<ImportResult>(
        `/import/upload${params}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );

      setResult(response.data);

      if (response.data.success > 0) {
        toast({
          title: '导入成功',
          description: `成功导入 ${response.data.success} 个文档`,
        });
        onSuccess?.();
      }
    } catch (error) {
      toast({
        title: '导入失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>导入文档</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FileUploader
            onFilesSelected={setFiles}
            disabled={isImporting}
          />

          {files.length > 0 && !result && (
            <div className="text-sm text-muted-foreground">
              已选择 {files.length} 个文件
            </div>
          )}

          {result && <ImportProgress result={result} />}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {result ? '关闭' : '取消'}
            </Button>
            {!result && (
              <Button
                onClick={handleImport}
                disabled={files.length === 0 || isImporting}
              >
                {isImporting ? '导入中...' : '开始导入'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.5 快捷键 Hook

```typescript
// apps/web/hooks/use-keyboard-shortcuts.ts

import { useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface ShortcutHandlers {
  onNewDocument?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useHotkeys('mod+n', (e) => {
    e.preventDefault();
    handlers.onNewDocument?.();
  });

  useHotkeys('mod+s', (e) => {
    e.preventDefault();
    handlers.onSave?.();
  });

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    handlers.onSearch?.();
  });

  useHotkeys('escape', () => {
    handlers.onEscape?.();
  });
}

// 快捷键说明
export const SHORTCUTS = [
  { keys: ['⌘', 'N'], description: '新建文档' },
  { keys: ['⌘', 'S'], description: '保存文档' },
  { keys: ['⌘', 'K'], description: '全局搜索' },
  { keys: ['Esc'], description: '关闭对话框' },
];
```

### 4.6 保存状态组件

```typescript
// apps/web/components/documents/save-status.tsx

'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveState = 'saved' | 'saving' | 'error' | 'idle';

interface SaveStatusProps {
  state: SaveState;
  lastSaved?: Date;
  className?: string;
}

export function SaveStatus({ state, lastSaved, className }: SaveStatusProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (state === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (state === 'idle') return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs',
        state === 'error' && 'text-destructive',
        state === 'saved' && !showSaved && 'opacity-0',
        className,
      )}
    >
      {state === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>保存中...</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span>已保存</span>
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle className="h-3 w-3" />
          <span>保存失败</span>
        </>
      )}
    </div>
  );
}
```

### 4.7 备份对话框

```typescript
// apps/web/components/backup/backup-dialog.tsx

'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { saveAs } from 'file-saver';

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupDialog({ open, onOpenChange }: BackupDialogProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/backup/export`,
      );
      const data = await response.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });

      const filename = `knowledge-base-backup-${new Date().toISOString().split('T')[0]}.json`;
      saveAs(blob, filename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>数据备份</DialogTitle>
          <DialogDescription>
            导出所有数据为 JSON 文件，包括文档、文件夹、标签、对话等。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">备份内容</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 所有文件夹结构</li>
              <li>• 所有文档内容</li>
              <li>• 所有标签</li>
              <li>• 所有对话记录</li>
              <li>• 所有文档模板</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  导出备份
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5. 共享类型定义

```typescript
// packages/shared/src/types/import.ts

export interface ImportResult {
  success: boolean;
  documentId?: string;
  title?: string;
  error?: string;
}

export interface BatchImportResult {
  total: number;
  success: number;
  failed: number;
  results: ImportResult[];
}

export interface BackupData {
  version: string;
  exportedAt: string;
  data: {
    folders: any[];
    documents: any[];
    tags: any[];
    documentTags: any[];
    conversations: any[];
    messages: any[];
    templates: any[];
  };
}

export interface ImportRestoreResult {
  success: boolean;
  imported: {
    folders: number;
    documents: number;
    tags: number;
    conversations: number;
    templates: number;
  };
  errors: string[];
}
```

---

## 6. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/import/formats` | 获取支持的文件格式 |
| POST | `/api/import/upload` | 上传并导入文件 |
| GET | `/api/export/document/:id` | 导出单个文档 |
| POST | `/api/export/documents` | 批量导出文档为 ZIP |
| GET | `/api/backup/export` | 导出全部数据 |
| POST | `/api/backup/import` | 导入备份数据 |

---

## 7. 文件产出清单

```
Phase 3-4 总计：新增 14 文件，修改 3 文件

后端新增 (11 files):
├── src/modules/import/
│   ├── import.module.ts
│   ├── import.service.ts
│   ├── import.controller.ts
│   └── parsers/
│       ├── parser.interface.ts
│       ├── md.parser.ts
│       ├── txt.parser.ts
│       ├── html.parser.ts
│       └── docx.parser.ts
├── src/modules/export/
│   ├── export.module.ts
│   ├── export.service.ts
│   └── export.controller.ts
└── src/modules/backup/
    ├── backup.module.ts
    ├── backup.service.ts
    └── backup.controller.ts

后端修改 (1 file):
└── src/app.module.ts

前端新增 (9 files):
├── components/import/
│   ├── file-uploader.tsx
│   ├── import-dialog.tsx
│   └── import-progress.tsx
├── components/backup/
│   ├── backup-dialog.tsx
│   └── restore-dialog.tsx
├── components/documents/
│   └── save-status.tsx
└── hooks/
    ├── use-import.ts
    ├── use-export.ts
    └── use-keyboard-shortcuts.ts

前端修改 (2 files):
├── app/(main)/documents/page.tsx
└── app/(main)/documents/[id]/page.tsx

共享包新增 (1 file):
└── packages/shared/src/types/
    └── import.ts
```

---

## 8. 新增依赖

### 后端

```bash
cd apps/api
pnpm add mammoth archiver adm-zip
```

### 前端

```bash
cd apps/web
pnpm add react-dropzone file-saver jszip react-hotkeys-hook
pnpm add -D @types/file-saver
```

---

## 9. 验证方案

### 9.1 后端验证

```bash
# 1. 获取支持的格式
curl http://localhost:4000/api/import/formats

# 2. 上传文件
curl -X POST http://localhost:4000/api/import/upload \
  -F "files=@test.md"

# 3. 导出文档
curl http://localhost:4000/api/export/document/{id}?format=md -o test.md

# 4. 备份数据
curl http://localhost:4000/api/backup/export -o backup.json
```

### 9.2 前端验证

```bash
# 安装依赖
cd apps/web && pnpm add react-dropzone file-saver jszip react-hotkeys-hook

# 启动前端
npx next dev

# 测试项目
# 1. 拖拽上传文件
# 2. 批量导入
# 3. 导出单个文档
# 4. 批量导出 ZIP
# 5. 数据备份
# 6. 数据恢复
# 7. 快捷键功能
# 8. 保存状态显示
```

---

## 10. 完成标准

- [ ] 文件导入 API 可用（支持 .md/.txt/.html/.docx）
- [ ] 批量导入功能可用
- [ ] 文档导出 API 可用（Markdown/HTML）
- [ ] 批量导出 ZIP 功能可用
- [ ] 数据备份 API 可用
- [ ] 数据恢复 API 可用
- [ ] 文件上传组件可用
- [ ] 导入对话框可用
- [ ] 备份对话框可用
- [ ] 快捷键功能可用
- [ ] 保存状态组件可用
- [ ] Swagger 文档更新
