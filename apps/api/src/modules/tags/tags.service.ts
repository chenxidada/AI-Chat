import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

const TAG_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取所有标签（按名称排序，包含关联文档数量）
   */
  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });
  }

  /**
   * 创建标签
   */
  async create(dto: CreateTagDto) {
    const color = dto.color ?? TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

    try {
      return await this.prisma.tag.create({
        data: {
          name: dto.name,
          color,
        },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`标签名称 "${dto.name}" 已存在`);
      }
      throw error;
    }
  }

  /**
   * 更新标签
   */
  async update(id: string, dto: UpdateTagDto) {
    await this.findOneOrThrow(id);

    try {
      return await this.prisma.tag.update({
        where: { id },
        data: dto,
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`标签名称 "${dto.name}" 已存在`);
      }
      throw error;
    }
  }

  /**
   * 删除标签（Cascade 会自动清理 DocumentTag 关联）
   */
  async remove(id: string) {
    await this.findOneOrThrow(id);

    await this.prisma.tag.delete({ where: { id } });

    return { message: '标签已删除' };
  }

  /**
   * 获取某标签下的文档（分页）
   */
  async findDocumentsByTag(tagId: string, page: number, limit: number) {
    await this.findOneOrThrow(tagId);

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.documentTag.count({ where: { tagId } }),
      this.prisma.documentTag.findMany({
        where: { tagId },
        skip,
        take: limit,
        include: {
          document: {
            include: {
              folder: true,
              tags: {
                include: { tag: true },
              },
            },
          },
        },
        orderBy: { document: { updatedAt: 'desc' } },
      }),
    ]);

    return {
      items: items.map((dt) => dt.document),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 查找标签，不存在则抛出 404
   */
  private async findOneOrThrow(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`标签 ID "${id}" 不存在`);
    }
    return tag;
  }
}
