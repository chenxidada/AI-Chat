import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { extractPlainText, countWords } from '../../common/utils/text.utils';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 分页查询文档列表 ─────────────────────────────────────────────────────────

  async findAll(query: QueryDocumentDto) {
    const {
      page = 1,
      limit = 20,
      folderId,
      tagId,
      isArchived,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      keyword,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    // 归档筛选
    if (isArchived !== undefined) {
      where.isArchived = isArchived === 'true';
    } else {
      where.isArchived = false; // 默认不显示归档
    }

    // 文件夹筛选
    if (folderId) {
      where.folderId = folderId;
    }

    // 标签筛选
    if (tagId) {
      where.tags = {
        some: { tagId },
      };
    }

    // 关键字搜索
    if (keyword) {
      where.title = {
        contains: keyword,
        mode: 'insensitive',
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          folder: {
            select: { id: true, name: true },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
    ]);

    // 将 tags 扁平化
    const formattedItems = items.map((doc) => ({
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    }));

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── 获取单个文档详情 ─────────────────────────────────────────────────────────

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        folder: {
          select: { id: true, name: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    return {
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    };
  }

  // ─── 创建文档 ──────────────────────────────────────────────────────────────────

  async create(dto: CreateDocumentDto) {
    const content = dto.content ?? '';
    const plainText = extractPlainText(content);
    const wordCnt = countWords(plainText);

    const doc = await this.prisma.document.create({
      data: {
        title: dto.title,
        content,
        contentPlain: plainText,
        wordCount: wordCnt,
        sourceType: dto.sourceType ?? 'manual',
        sourceUrl: dto.sourceUrl ?? null,
        folderId: dto.folderId ?? null,
        ...(dto.tagIds && dto.tagIds.length > 0
          ? {
              tags: {
                create: dto.tagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    return {
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    };
  }

  // ─── 更新文档 ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateDocumentDto) {
    const existing = await this.prisma.document.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    const data: any = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.folderId !== undefined) data.folderId = dto.folderId ?? null;
    if (dto.sourceType !== undefined) data.sourceType = dto.sourceType;
    if (dto.sourceUrl !== undefined) data.sourceUrl = dto.sourceUrl ?? null;

    // 如果内容更新，重新提取纯文本和统计字数
    if (dto.content !== undefined) {
      data.content = dto.content;
      data.contentPlain = extractPlainText(dto.content);
      data.wordCount = countWords(data.contentPlain);
    }

    // 标签替换：先删后建
    if (dto.tagIds !== undefined) {
      await this.prisma.documentTag.deleteMany({ where: { documentId: id } });
      if (dto.tagIds.length > 0) {
        await this.prisma.documentTag.createMany({
          data: dto.tagIds.map((tagId) => ({ documentId: id, tagId })),
        });
      }
    }

    const doc = await this.prisma.document.update({
      where: { id },
      data,
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    return {
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    };
  }

  // ─── 软删除（归档） ───────────────────────────────────────────────────────────

  async archive(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    return this.prisma.document.update({
      where: { id },
      data: { isArchived: !doc.isArchived },
      select: { id: true, isArchived: true },
    });
  }

  // ─── 永久删除 ──────────────────────────────────────────────────────────────────

  async removePermanent(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    await this.prisma.document.delete({ where: { id } });
    return { id };
  }

  // ─── 移动到文件夹 ──────────────────────────────────────────────────────────────

  async move(id: string, folderId: string | null) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        throw new NotFoundException(`目标文件夹 ${folderId} 不存在`);
      }
    }

    return this.prisma.document.update({
      where: { id },
      data: { folderId: folderId ?? null },
      select: { id: true, folderId: true },
    });
  }

  // ─── 最近文档 ──────────────────────────────────────────────────────────────────

  async findRecent(limit: number = 10) {
    const docs = await this.prisma.document.findMany({
      where: { isArchived: false },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    return docs.map((doc) => ({
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    }));
  }
}
