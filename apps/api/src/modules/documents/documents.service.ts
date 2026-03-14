import {
  Injectable,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { MeiliService } from '../search/meili.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { extractPlainText, countWords } from '../../common/utils/text.utils';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  // Cache key prefixes
  private readonly CACHE_PREFIX = 'doc';
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @Optional() private readonly meili?: MeiliService,
  ) {}

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
      isFavorite,
      isPinned,
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

    // 收藏筛选
    if (isFavorite !== undefined) {
      where.isFavorite = isFavorite === 'true';
    }

    // 置顶筛选
    if (isPinned !== undefined) {
      where.isPinned = isPinned === 'true';
    }

    const [total, items] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { [sortBy]: sortOrder },
        ],
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
    const cacheKey = `${this.CACHE_PREFIX}:detail:${id}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
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
      },
      this.CACHE_TTL,
    );
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

    const result = {
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    };

    // 异步同步到 Meilisearch
    this.syncToMeili(doc).catch((err) =>
      this.logger.warn(`Meilisearch sync failed on create: ${err.message}`),
    );

    return result;
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

    const result = {
      ...doc,
      tags: doc.tags.map((dt) => dt.tag),
    };

    // Invalidate cache
    await this.cacheService.del(`${this.CACHE_PREFIX}:detail:${id}`);

    // 异步同步到 Meilisearch
    this.syncToMeili(doc).catch((err) =>
      this.logger.warn(`Meilisearch sync failed on update: ${err.message}`),
    );

    return result;
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
    }).then(async (result) => {
      await this.cacheService.del(`${this.CACHE_PREFIX}:detail:${id}`);
      return result;
    });
  }

  // ─── 永久删除 ──────────────────────────────────────────────────────────────────

  async removePermanent(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    await this.prisma.document.delete({ where: { id } });

    // Invalidate cache
    await this.cacheService.del(`${this.CACHE_PREFIX}:detail:${id}`);

    // 从 Meilisearch 删除
    this.meili?.removeDocument(id).catch((err) =>
      this.logger.warn(`Meilisearch delete failed: ${err.message}`),
    );

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
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' },
      ],
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

  // ─── 收藏文档列表 ──────────────────────────────────────────────────────────────

  async findFavorites(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.document.count({
        where: {
          isFavorite: true,
          isArchived: false,
        },
      }),
      this.prisma.document.findMany({
        where: {
          isFavorite: true,
          isArchived: false,
        },
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { updatedAt: 'desc' },
        ],
        include: {
          folder: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      }),
    ]);

    return {
      items: items.map((doc) => ({
        ...doc,
        tags: doc.tags.map((dt) => dt.tag),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── 切换收藏状态 ──────────────────────────────────────────────────────────────

  async toggleFavorite(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { isFavorite: true },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { isFavorite: !doc.isFavorite },
    });

    return { isFavorite: updated.isFavorite };
  }

  // ─── 切换置顶状态 ──────────────────────────────────────────────────────────────

  async togglePin(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { isPinned: true },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { isPinned: !doc.isPinned },
    });

    return { isPinned: updated.isPinned };
  }

  // ─── 切换文件夹置顶状态 ────────────────────────────────────────────────────────

  async toggleFolderPin(id: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      select: { isPinned: true },
    });

    if (!folder) {
      throw new NotFoundException(`文件夹 ${id} 不存在`);
    }

    const updated = await this.prisma.folder.update({
      where: { id },
      data: { isPinned: !folder.isPinned },
    });

    return { isPinned: updated.isPinned };
  }

  // ─── 复制文档 ──────────────────────────────────────────────────────────────────

  async duplicate(id: string) {
    const original = await this.prisma.document.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });

    if (!original) {
      throw new NotFoundException(`文档 ${id} 不存在`);
    }

    // 创建副本
    const copy = await this.prisma.document.create({
      data: {
        title: `${original.title} (副本)`,
        content: original.content,
        contentPlain: original.contentPlain,
        folderId: original.folderId,
        sourceType: 'manual',
        wordCount: original.wordCount,
        tags: original.tags.length
          ? {
              create: original.tags.map((t) => ({ tagId: t.tagId })),
            }
          : undefined,
      },
      include: {
        folder: true,
        tags: { include: { tag: true } },
      },
    });

    const result = {
      ...copy,
      tags: copy.tags.map((dt) => dt.tag),
    };

    // 同步到 Meilisearch
    this.syncToMeili(result).catch((err) =>
      this.logger.warn(`Meilisearch sync failed on duplicate: ${err.message}`),
    );

    return result;
  }

  // ─── Meilisearch 同步 ────────────────────────────────────────────────────────

  private async syncToMeili(doc: any): Promise<void> {
    if (!this.meili) return;
    await this.meili.indexDocument({
      id: doc.id,
      title: doc.title,
      contentPlain: doc.contentPlain,
      folderId: doc.folderId,
      folderName: doc.folder?.name || null,
      tagIds: doc.tags.map((t: any) => t.tagId ?? t.id),
      tags: doc.tags.map((t: any) => t.tag?.name ?? t.name),
      sourceType: doc.sourceType,
      isArchived: doc.isArchived,
      wordCount: doc.wordCount,
      createdAt: Math.floor(new Date(doc.createdAt).getTime() / 1000),
      updatedAt: Math.floor(new Date(doc.updatedAt).getTime() / 1000),
    });
  }
}

