import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLinkDto } from './dto/create-link.dto';

export interface LinkWithDocument {
  id: string;
  documentId: string;
  documentTitle: string;
  linkText: string;
  position: { start: number; end: number };
  createdAt: Date;
}

@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建链接
   */
  async create(dto: CreateLinkDto) {
    // 检查源文档和目标文档是否存在
    const [sourceDoc, targetDoc] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id: dto.sourceDocId },
        select: { id: true },
      }),
      this.prisma.document.findUnique({
        where: { id: dto.targetDocId },
        select: { id: true, title: true },
      }),
    ]);

    if (!sourceDoc) {
      throw new NotFoundException(`源文档 ${dto.sourceDocId} 不存在`);
    }
    if (!targetDoc) {
      throw new NotFoundException(`目标文档 ${dto.targetDocId} 不存在`);
    }

    // 检查链接是否已存在
    const existing = await this.prisma.biLink.findUnique({
      where: {
        sourceDocId_targetDocId: {
          sourceDocId: dto.sourceDocId,
          targetDocId: dto.targetDocId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('该链接已存在');
    }

    return this.prisma.biLink.create({
      data: {
        sourceDocId: dto.sourceDocId,
        targetDocId: dto.targetDocId,
        linkText: dto.linkText || targetDoc.title,
        position: dto.position || {},
      },
    });
  }

  /**
   * 获取文档的出站链接（当前文档链接到的其他文档）
   */
  async getOutboundLinks(documentId: string): Promise<LinkWithDocument[]> {
    const links = await this.prisma.biLink.findMany({
      where: { sourceDocId: documentId },
      include: {
        targetDoc: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id,
      documentId: link.targetDoc.id,
      documentTitle: link.targetDoc.title,
      linkText: link.linkText,
      position: link.position as { start: number; end: number },
      createdAt: link.createdAt,
    }));
  }

  /**
   * 获取文档的反向链接（其他文档链接到当前文档）
   */
  async getBacklinks(documentId: string): Promise<LinkWithDocument[]> {
    const links = await this.prisma.biLink.findMany({
      where: { targetDocId: documentId },
      include: {
        sourceDoc: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id,
      documentId: link.sourceDoc.id,
      documentTitle: link.sourceDoc.title,
      linkText: link.linkText,
      position: link.position as { start: number; end: number },
      createdAt: link.createdAt,
    }));
  }

  /**
   * 删除链接
   */
  async remove(id: string) {
    const link = await this.prisma.biLink.findUnique({
      where: { id },
    });

    if (!link) {
      throw new NotFoundException(`链接 ${id} 不存在`);
    }

    await this.prisma.biLink.delete({ where: { id } });
    return { id };
  }

  /**
   * 批量更新文档链接（解析文档内容并重建链接）
   */
  async updateDocumentLinks(documentId: string, content: string) {
    // 解析内容中的链接
    const links = this.parseLinks(content);

    // 删除现有链接
    await this.prisma.biLink.deleteMany({
      where: { sourceDocId: documentId },
    });

    // 创建新链接
    let count = 0;
    for (const link of links) {
      try {
        await this.prisma.biLink.create({
          data: {
            sourceDocId: documentId,
            targetDocId: link.targetDocId,
            linkText: link.linkText,
            position: link.position,
          },
        });
        count++;
      } catch (error) {
        // 忽略目标文档不存在的错误
        this.logger.warn(`创建链接失败: ${error.message}`);
      }
    }

    return { count };
  }

  /**
   * 解析文档内容中的链接
   * 链接格式：<a data-doc-id="uuid">文本</a>
   */
  private parseLinks(
    content: string,
  ): Array<{ targetDocId: string; linkText: string; position: object }> {
    const links: Array<{
      targetDocId: string;
      linkText: string;
      position: object;
    }> = [];
    const regex = /<a[^>]*data-doc-id="([^"]+)"[^>]*>([^<]*)<\/a>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      links.push({
        targetDocId: match[1],
        linkText: match[2],
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    return links;
  }

  /**
   * 搜索文档标题（用于链接建议）
   */
  async searchDocuments(query: string, excludeId?: string) {
    const where: any = {
      isArchived: false,
    };

    if (query) {
      where.title = {
        contains: query,
        mode: 'insensitive',
      };
    }

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return this.prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        folder: { select: { name: true } },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });
  }
}
