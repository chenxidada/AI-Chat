import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

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
  }) {
    const { page = 1, limit = 20, isArchived = false, mode } = params;
    const skip = (page - 1) * limit;

    const where: any = { isArchived };
    if (mode) where.mode = mode;

    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
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
}
