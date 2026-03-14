import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  QueryTemplateDto,
  UseTemplateDto,
} from './dto/template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建模板
   */
  async create(dto: CreateTemplateDto) {
    return this.prisma.documentTemplate.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        content: dto.content || '',
        category: dto.category || 'general',
        icon: dto.icon || null,
        isPublic: dto.isPublic || false,
      },
    });
  }

  /**
   * 获取模板列表
   */
  async findAll(dto: QueryTemplateDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.documentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.documentTemplate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取模板详情
   */
  async findOne(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`模板 ${id} 不存在`);
    }

    return template;
  }

  /**
   * 更新模板
   */
  async update(id: string, dto: UpdateTemplateDto) {
    await this.findOne(id); // 检查是否存在

    return this.prisma.documentTemplate.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除模板
   */
  async remove(id: string) {
    await this.findOne(id); // 检查是否存在

    await this.prisma.documentTemplate.delete({ where: { id } });
    return { id };
  }

  /**
   * 使用模板创建文档
   */
  async useTemplate(id: string, dto: UseTemplateDto) {
    const template = await this.findOne(id);

    // 增加使用次数
    await this.prisma.documentTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    // 创建文档
    const document = await this.prisma.document.create({
      data: {
        title: dto.title,
        content: template.content,
        folderId: dto.folderId || null,
        sourceType: 'template',
        wordCount: this.countWords(template.content),
        contentPlain: this.stripMarkdown(template.content),
      },
      include: {
        folder: { select: { id: true, name: true } },
        tags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
    });

    return {
      ...document,
      tags: document.tags.map((t) => t.tag),
      templateId: template.id,
      templateName: template.name,
    };
  }

  /**
   * 获取模板分类列表
   */
  async getCategories() {
    const result = await this.prisma.documentTemplate.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { category: 'asc' },
    });

    return result.map((r) => ({
      name: r.category,
      count: r._count.id,
    }));
  }

  /**
   * 获取热门模板
   */
  async getPopular(limit: number = 10) {
    return this.prisma.documentTemplate.findMany({
      take: limit,
      orderBy: { usageCount: 'desc' },
    });
  }

  /**
   * 统计字数
   */
  private countWords(content: string): number {
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
