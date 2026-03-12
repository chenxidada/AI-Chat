import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService, ChatMessage } from './llm.service';
import { RagService } from './rag.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // 系统提示词
  private readonly systemPrompts = {
    general: `你是一个乐于助人的AI助手。请用清晰、准确的语言回答用户的问题。
- 保持回答简洁专业
- 如果不确定，请诚实说明
- 可以使用 Markdown 格式组织内容`,

    knowledge_base: `你是一个专业的个人知识库助手。请基于提供的参考资料回答问题。
- 严格基于提供的参考资料，不要编造信息
- 在回答中引用资料来源，使用格式 [1]、[2] 对应参考资料编号
- 如果资料中没有相关信息，请说明"根据提供的资料，没有找到相关信息"
- 保持回答简洁专业`,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * 发送消息并获取 AI 回复
   */
  async chat(dto: ChatDto) {
    // 1. 获取或创建对话
    let conversationId: string;
    let isNewConversation = !dto.conversationId;

    if (isNewConversation) {
      const conversation = await this.conversations.create({
        mode: dto.mode || 'general',
      });
      conversationId = conversation.id;
    } else {
      conversationId = dto.conversationId!;
    }

    // 2. 获取对话历史
    const conversation = await this.conversations.findOne(conversationId);
    const history = this.buildHistory(conversation.messages || []);

    let response: { answer: string; tokenUsage: any; citations?: any[] };

    // 3. 根据模式选择处理方式
    if (dto.mode === 'knowledge_base') {
      // RAG 模式
      const ragResponse = await this.rag.generateAnswer({
        question: dto.question,
        conversationHistory: history,
        context: {
          documentIds: (conversation as any).contextDocumentIds?.length
            ? (conversation as any).contextDocumentIds
            : undefined,
          folderId: (conversation as any).contextFolderId || undefined,
          tagIds: (conversation as any).contextTagIds?.length
            ? (conversation as any).contextTagIds
            : undefined,
        },
        temperature: dto.temperature,
      });

      response = {
        answer: ragResponse.answer,
        tokenUsage: ragResponse.tokenUsage,
        citations: ragResponse.citations,
      };
    } else {
      // 通用模式
      const messages = this.buildMessages(history, dto.question, 'general');
      const llmResponse = await this.llm.chat(messages, {
        temperature: dto.temperature,
      });

      response = {
        answer: llmResponse.content,
        tokenUsage: llmResponse.tokenUsage,
      };
    }

    // 4. 保存消息
    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: dto.question,
      },
    });

    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: response.answer,
        citations: response.citations || [],
        tokenUsage: response.tokenUsage,
      },
    });

    // 5. 更新对话 token 使用量
    await this.conversations.incrementTokens(
      conversationId,
      response.tokenUsage.totalTokens,
    );

    // 6. 如果是新对话，生成标题
    if (isNewConversation) {
      const title = await this.llm.generateTitle(dto.question);
      await this.conversations.update(conversationId, { title });
    }

    return {
      conversationId,
      messageId: assistantMessage.id,
      answer: response.answer,
      citations: response.citations || [],
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * 构建历史消息
   */
  private buildHistory(messages: any[]): ChatMessage[] {
    return messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    history: ChatMessage[],
    question: string,
    mode: 'general' | 'knowledge_base',
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 系统提示词
    messages.push({
      role: 'system',
      content: this.systemPrompts[mode],
    });

    // 历史消息
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // 当前问题
    messages.push({
      role: 'user',
      content: question,
    });

    return messages;
  }
}
