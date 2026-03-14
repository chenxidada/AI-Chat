import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ExportFormat,
  ImportSource,
  ExportBatchDto,
  ImportDocumentDto,
  BackupDto,
} from './dto/import-export.dto';
import * as yaml from 'js-yaml';

interface ExportedDocument {
  id: string;
  title: string;
  content: string;
  folder?: { id: string; name: string; path: string } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  documents: ExportedDocument[];
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    isPinned: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  tags: Array<{
    id: string;
    name: string;
    color: string;
    createdAt: Date;
  }>;
  links: Array<{
    id: string;
    sourceDocId: string;
    targetDocId: string;
    linkText: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class ImportExportService {
  private readonly logger = new Logger(ImportExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 导出单个文档
   */
  async exportDocument(
    documentId: string,
    format: ExportFormat,
    includeMetadata: boolean = true,
  ): Promise<{ content: string; filename: string; mimeType: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        folder: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`文档 ${documentId} 不存在`);
    }

    // 转换 tags 格式
    const docWithTags = {
      ...document,
      tags: document.tags.map((t) => t.tag),
    };

    const filename = this.sanitizeFilename(document.title);

    switch (format) {
      case ExportFormat.MARKDOWN:
        return {
          content: this.toMarkdown(docWithTags, includeMetadata),
          filename: `${filename}.md`,
          mimeType: 'text/markdown',
        };

      case ExportFormat.JSON:
        return {
          content: JSON.stringify(docWithTags, null, 2),
          filename: `${filename}.json`,
          mimeType: 'application/json',
        };

      case ExportFormat.HTML:
        return {
          content: this.toHtml(docWithTags, includeMetadata),
          filename: `${filename}.html`,
          mimeType: 'text/html',
        };

      default:
        throw new BadRequestException(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 批量导出文档
   */
  async exportBatch(dto: ExportBatchDto): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    const documents = await this.prisma.document.findMany({
      where: { id: { in: dto.documentIds } },
      include: {
        folder: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (documents.length === 0) {
      throw new NotFoundException('未找到任何文档');
    }

    // 转换 tags 格式
    const docsWithTags = documents.map((doc) => ({
      ...doc,
      tags: doc.tags.map((t) => t.tag),
    }));

    if (dto.format === ExportFormat.JSON) {
      return {
        content: JSON.stringify(docsWithTags, null, 2),
        filename: `documents-export-${Date.now()}.json`,
        mimeType: 'application/json',
      };
    }

    // Markdown 格式：打包为多个文件
    const contents = docsWithTags.map((doc) => ({
      filename: `${this.sanitizeFilename(doc.title)}.md`,
      content: this.toMarkdown(doc, true),
    }));

    // 返回 JSON 格式的文件列表，前端可以打包为 zip
    return {
      content: JSON.stringify(contents, null, 2),
      filename: `documents-export-${Date.now()}.json`,
      mimeType: 'application/json',
    };
  }

  /**
   * 导入文档
   */
  async importDocument(dto: ImportDocumentDto): Promise<{
    id: string;
    title: string;
    isNew: boolean;
  }> {
    let title: string;
    let content: string;
    let metadata: Record<string, any> = {};

    switch (dto.source) {
      case ImportSource.MARKDOWN:
        const parsed = this.parseMarkdown(dto.content);
        title = parsed.title || dto.filename?.replace(/\.md$/, '') || '未命名文档';
        content = parsed.content;
        metadata = parsed.metadata;
        break;

      case ImportSource.JSON:
        const jsonData = this.parseJson(dto.content);
        title = jsonData.title || '未命名文档';
        content = jsonData.content || '';
        metadata = jsonData.metadata || {};
        break;

      case ImportSource.OBSIDIAN:
        const obsidianParsed = this.parseObsidian(dto.content);
        title = obsidianParsed.title || dto.filename?.replace(/\.md$/, '') || '未命名文档';
        content = obsidianParsed.content;
        metadata = obsidianParsed.metadata;
        break;

      case ImportSource.NOTION:
        const notionParsed = this.parseNotion(dto.content);
        title = notionParsed.title || '未命名文档';
        content = notionParsed.content;
        metadata = notionParsed.metadata;
        break;

      default:
        throw new BadRequestException(`不支持的导入来源: ${dto.source}`);
    }

    // 创建文档
    const document = await this.prisma.document.create({
      data: {
        title,
        content,
        folderId: dto.folderId || null,
        metadata,
        sourceType: 'import',
        wordCount: this.countWords(content),
        contentPlain: this.stripMarkdown(content),
      },
    });

    return {
      id: document.id,
      title: document.title,
      isNew: true,
    };
  }

  /**
   * 批量导入文档
   */
  async importBatch(
    files: Array<{ content: string; filename: string }>,
    source: ImportSource,
    folderId?: string,
  ): Promise<Array<{ id: string; title: string; filename: string }>> {
    const results = [];

    for (const file of files) {
      try {
        const result = await this.importDocument({
          source,
          content: file.content,
          filename: file.filename,
          folderId,
        });
        results.push({
          ...result,
          filename: file.filename,
        });
      } catch (error) {
        this.logger.error(`导入文件 ${file.filename} 失败: ${error.message}`);
        results.push({
          id: '',
          title: file.filename,
          filename: file.filename,
          error: error.message,
        } as any);
      }
    }

    return results;
  }

  /**
   * 创建完整备份
   */
  async createBackup(dto: BackupDto): Promise<BackupData> {
    const backup: BackupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      documents: [],
      folders: [],
      tags: [],
      links: [],
    };

    if (dto.includeDocuments !== false) {
      const docs = await this.prisma.document.findMany({
        include: {
          folder: { select: { id: true, name: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      backup.documents = docs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        folder: doc.folder
          ? {
              id: doc.folder.id,
              name: doc.folder.name,
              path: doc.folder.name,
            }
          : null,
        tags: doc.tags.map((t) => t.tag),
        isFavorite: doc.isFavorite,
        isPinned: doc.isPinned,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        metadata: doc.metadata as Record<string, any>,
      }));
    }

    if (dto.includeFolders !== false) {
      backup.folders = await this.prisma.folder.findMany({
        orderBy: { sortOrder: 'asc' },
      });
    }

    if (dto.includeTags !== false) {
      backup.tags = await this.prisma.tag.findMany();
    }

    if (dto.includeLinks !== false) {
      backup.links = await this.prisma.biLink.findMany();
    }

    return backup;
  }

  /**
   * 从备份恢复
   */
  async restoreBackup(backupData: BackupData): Promise<{
    documents: number;
    folders: number;
    tags: number;
    links: number;
  }> {
    const counts = {
      documents: 0,
      folders: 0,
      tags: 0,
      links: 0,
    };

    // 使用事务确保原子性
    await this.prisma.$transaction(async (tx) => {
      // 恢复标签
      if (backupData.tags?.length > 0) {
        for (const tag of backupData.tags) {
          await tx.tag.upsert({
            where: { id: tag.id },
            update: { name: tag.name, color: tag.color },
            create: tag,
          });
        }
        counts.tags = backupData.tags.length;
      }

      // 恢复文件夹
      if (backupData.folders?.length > 0) {
        for (const folder of backupData.folders) {
          await tx.folder.upsert({
            where: { id: folder.id },
            update: {
              name: folder.name,
              parentId: folder.parentId,
              isPinned: folder.isPinned,
              sortOrder: folder.sortOrder,
            },
            create: {
              id: folder.id,
              name: folder.name,
              parentId: folder.parentId,
              isPinned: folder.isPinned,
              sortOrder: folder.sortOrder,
              createdAt: folder.createdAt,
              updatedAt: folder.updatedAt,
            },
          });
        }
        counts.folders = backupData.folders.length;
      }

      // 恢复文档
      if (backupData.documents?.length > 0) {
        for (const doc of backupData.documents) {
          await tx.document.upsert({
            where: { id: doc.id },
            update: {
              title: doc.title,
              content: doc.content,
              folderId: doc.folder?.id || null,
              isFavorite: doc.isFavorite,
              isPinned: doc.isPinned,
              metadata: doc.metadata,
            },
            create: {
              id: doc.id,
              title: doc.title,
              content: doc.content,
              folderId: doc.folder?.id || null,
              isFavorite: doc.isFavorite,
              isPinned: doc.isPinned,
              metadata: doc.metadata,
              sourceType: 'import',
              wordCount: this.countWords(doc.content),
              contentPlain: this.stripMarkdown(doc.content),
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
            },
          });

          // 恢复文档标签关联
          if (doc.tags?.length > 0) {
            await tx.documentTag.deleteMany({
              where: { documentId: doc.id },
            });
            await tx.documentTag.createMany({
              data: doc.tags.map((tag) => ({
                documentId: doc.id,
                tagId: tag.id,
              })),
            });
          }
        }
        counts.documents = backupData.documents.length;
      }

      // 恢复链接
      if (backupData.links?.length > 0) {
        for (const link of backupData.links) {
          await tx.biLink.upsert({
            where: { id: link.id },
            update: {
              sourceDocId: link.sourceDocId,
              targetDocId: link.targetDocId,
              linkText: link.linkText,
            },
            create: {
              id: link.id,
              sourceDocId: link.sourceDocId,
              targetDocId: link.targetDocId,
              linkText: link.linkText,
              createdAt: link.createdAt,
            },
          });
        }
        counts.links = backupData.links.length;
      }
    });

    return counts;
  }

  /**
   * 转换为 Markdown 格式
   */
  private toMarkdown(doc: any, includeMetadata: boolean): string {
    let content = '';

    if (includeMetadata) {
      content += '---\n';
      content += `title: "${doc.title}"\n`;
      content += `created: ${doc.createdAt.toISOString()}\n`;
      content += `updated: ${doc.updatedAt.toISOString()}\n`;
      if (doc.folder) {
        content += `folder: "${doc.folder.name}"\n`;
      }
      if (doc.tags?.length > 0) {
        content += `tags: [${doc.tags.map((t: any) => `"${t.name}"`).join(', ')}]\n`;
      }
      if (doc.isFavorite) {
        content += 'favorite: true\n';
      }
      if (doc.isPinned) {
        content += 'pinned: true\n';
      }
      content += '---\n\n';
    }

    content += doc.content;
    return content;
  }

  /**
   * 转换为 HTML 格式
   */
  private toHtml(doc: any, includeMetadata: boolean): string {
    let html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n';
    html += `<meta charset="UTF-8">\n`;
    html += `<title>${this.escapeHtml(doc.title)}</title>\n`;
    html += `<style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      .metadata { background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
      .metadata span { margin-right: 15px; }
      .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; margin-right: 5px; font-size: 12px; }
      pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
      code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
      blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 15px; color: #666; }
    </style>\n`;
    html += '</head>\n<body>\n';

    if (includeMetadata) {
      html += '<div class="metadata">\n';
      html += `<span>Created: ${doc.createdAt.toLocaleDateString()}</span>\n`;
      html += `<span>Updated: ${doc.updatedAt.toLocaleDateString()}</span>\n`;
      if (doc.folder) {
        html += `<span>Folder: ${this.escapeHtml(doc.folder.name)}</span>\n`;
      }
      if (doc.tags?.length > 0) {
        html += '<div>Tags: ';
        doc.tags.forEach((tag: any) => {
          html += `<span class="tag" style="background-color: ${tag.color}20; color: ${tag.color}">${this.escapeHtml(tag.name)}</span>`;
        });
        html += '</div>\n';
      }
      html += '</div>\n';
    }

    html += `<h1>${this.escapeHtml(doc.title)}</h1>\n`;
    html += this.markdownToHtml(doc.content);
    html += '</body>\n</html>';

    return html;
  }

  /**
   * 解析 Markdown 文件
   */
  private parseMarkdown(content: string): {
    title: string;
    content: string;
    metadata: Record<string, any>;
  } {
    let title = '';
    let metadata: Record<string, any> = {};
    let bodyContent = content;

    // 解析 YAML frontmatter
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex > 0) {
        const frontmatter = content.slice(4, endIndex);
        try {
          metadata = yaml.load(frontmatter) as Record<string, any>;
          title = metadata.title || '';
          bodyContent = content.slice(endIndex + 5);
        } catch (e) {
          this.logger.warn('解析 YAML frontmatter 失败');
        }
      }
    }

    // 如果没有从 frontmatter 获取标题，尝试从第一个标题获取
    if (!title) {
      const titleMatch = bodyContent.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
        // 移除标题行
        bodyContent = bodyContent.replace(titleMatch[0], '').trim();
      }
    }

    return { title, content: bodyContent, metadata };
  }

  /**
   * 解析 JSON 文件
   */
  private parseJson(content: string): {
    title: string;
    content: string;
    metadata: Record<string, any>;
  } {
    try {
      const data = JSON.parse(content);
      return {
        title: data.title || '',
        content: data.content || '',
        metadata: data.metadata || {},
      };
    } catch (e) {
      throw new BadRequestException('无效的 JSON 格式');
    }
  }

  /**
   * 解析 Obsidian 格式
   */
  private parseObsidian(content: string): {
    title: string;
    content: string;
    metadata: Record<string, any>;
  } {
    // Obsidian 使用类似的 YAML frontmatter
    const result = this.parseMarkdown(content);

    // 处理 Obsidian 特有的链接语法 [[文档名]]
    result.content = result.content.replace(
      /\[\[([^\]]+)\]\]/g,
      '[$1]($1)',
    );

    return result;
  }

  /**
   * 解析 Notion 导出格式
   */
  private parseNotion(content: string): {
    title: string;
    content: string;
    metadata: Record<string, any>;
  } {
    // Notion 导出的 Markdown 格式
    return this.parseMarkdown(content);
  }

  /**
   * 清理文件名
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100);
  }

  /**
   * 转义 HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 简单的 Markdown 转 HTML
   */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>');
  }

  /**
   * 统计字数
   */
  private countWords(content: string): number {
    // 中文按字符数，英文按单词数
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 移除 Markdown 格式
   */
  private stripMarkdown(content: string): string {
    return content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();
  }
}
