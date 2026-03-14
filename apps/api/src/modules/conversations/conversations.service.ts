import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { BatchOperationDto } from './dto/batch-operation.dto';
import { SearchConversationDto } from './dto/search.dto';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建新对话
   */
  async create(dto: CreateConversationDto) {
    return this.prisma.conversation.create({
      data: {
        title: dto.title || '新对话',
        mode: dto.mode || 'general',
        contextDocumentIds: dto.contextDocumentIds || [],
        contextFolderId: dto.contextFolderId || null,
        contextTagIds: dto.contextTagIds || [],
      },
    });
  }

  /**
   * 获取对话列表
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    isArchived?: boolean;
    mode?: string;
    isPinned?: boolean;
    isStarred?: boolean;
  }) {
    const { page = 1, limit = 20, isArchived = false, mode, isPinned, isStarred } = params;
    const skip = (page - 1) * limit;

    const where: any = { isArchived };
    if (mode) where.mode = mode;
    if (isPinned !== undefined) where.isPinned = isPinned;
    if (isStarred !== undefined) where.isStarred = isStarred;

    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { isStarred: 'desc' },
          { updatedAt: 'desc' },
        ],
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((conv) => ({
        ...conv,
        messageCount: conv._count.messages,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取对话详情（含消息）
   */
  async findOne(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`对话 ${id} 不存在`);
    }

    return conversation;
  }

  /**
   * 更新对话
   */
  async update(
    id: string,
    data: {
      title?: string;
      isArchived?: boolean;
      contextDocumentIds?: string[];
      contextFolderId?: string | null;
      contextTagIds?: string[];
    },
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`对话 ${id} 不存在`);
    }

    return this.prisma.conversation.update({
      where: { id },
      data,
    });
  }

  /**
   * 删除对话
   */
  async remove(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`对话 ${id} 不存在`);
    }

    await this.prisma.conversation.delete({ where: { id } });
    return { id };
  }

  /**
   * 增加对话的 token 使用量
   */
  async incrementTokens(id: string, tokens: number) {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        totalTokens: { increment: tokens },
      },
    });
  }

  /**
   * 切换置顶状态
   */
  async togglePin(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`对话 ${id} 不存在`);
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { isPinned: !conversation.isPinned },
    });
  }

  /**
   * 切换星标状态
   */
  async toggleStar(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`对话 ${id} 不存在`);
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { isStarred: !conversation.isStarred },
    });
  }

  /**
   * 批量操作
   */
  async batchOperation(dto: BatchOperationDto) {
    const { ids, operation } = dto;

    switch (operation) {
      case 'archive':
        return this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: true },
        });

      case 'unarchive':
        return this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data: { isArchived: false },
        });

      case 'delete':
        return this.prisma.$transaction([
          this.prisma.message.deleteMany({
            where: { conversationId: { in: ids } },
          }),
          this.prisma.conversation.deleteMany({
            where: { id: { in: ids } },
          }),
        ]);

      case 'pin':
        return this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data: { isPinned: true },
        });

      case 'unpin':
        return this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data: { isPinned: false },
        });

      case 'star':
        return this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data: { isStarred: true },
        });

      case 'unstar':
        return this.prisma.conversation.updateMany({
          where: { id: { in: ids } },
          data: { isStarred: false },
        });

      default:
        throw new Error(`不支持的操作: ${operation}`);
    }
  }

  /**
   * 搜索对话
   */
  async search(dto: SearchConversationDto) {
    const { query, page = 1, limit = 20, mode, isPinned, isStarred } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // 构建搜索条件
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: query, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    // 过滤条件
    if (mode) where.mode = mode;
    if (isPinned !== undefined) where.isPinned = isPinned;
    if (isStarred !== undefined) where.isStarred = isStarred;

    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((conv) => ({
        ...conv,
        messageCount: conv._count.messages,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
