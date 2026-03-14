import { Injectable, Logger } from '@nestjs/common';
import { Observable, from, map, catchError, of } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService, ChatMessage } from './llm.service';
import { RagService } from './rag.service';
import { StreamingService, StreamEvent } from './streaming.service';
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

    summary: `你是一个专业的对话摘要助手。请为对话生成简洁的摘要。
- 摘要应在 100-200 字以内
- 提取关键信息和结论
- 保留重要细节
- 使用简洁的语言`,

    suggestion: `你是一个对话建议助手。基于对话历史，建议用户可能想问的下一个问题。
- 提供 3 个相关建议
- 建议应具体且可操作
- 与对话主题相关`,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly streaming: StreamingService,
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

  /**
   * 流式聊天
   */
  async chatStream(dto: ChatDto): Promise<Observable<MessageEvent>> {
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

    // 3. 构建消息
    const mode = (dto.mode || 'general') as 'general' | 'knowledge_base';
    const messages = this.buildMessages(history, dto.question, mode);

    // 4. 如果是 RAG 模式，先获取上下文
    let contextData: { context?: string; citations?: any[] } = {};
    if (dto.mode === 'knowledge_base') {
      const ragContext = await this.rag.retrieveContext({
        question: dto.question,
        context: {
          documentIds: (conversation as any).contextDocumentIds?.length
            ? (conversation as any).contextDocumentIds
            : undefined,
          folderId: (conversation as any).contextFolderId || undefined,
          tagIds: (conversation as any).contextTagIds?.length
            ? (conversation as any).contextTagIds
            : undefined,
        },
      });
      contextData = ragContext;

      // 在系统提示后添加上下文
      messages.splice(1, 0, {
        role: 'system',
        content: `参考资料：\n${ragContext.context}`,
      });
    }

    // 5. 保存用户消息
    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: dto.question,
      },
    });

    // 6. 生成流式响应
    const streamGenerator = this.streaming.streamChat(messages, {
      temperature: dto.temperature,
    });

    let fullContent = '';
    let tokenUsage = { totalTokens: 0 };

    // 7. 转换为 Observable
    return from(streamGenerator).pipe(
      map((event: StreamEvent) => {
        if (event.type === 'chunk') {
          fullContent += event.data.content;
        }
        if (event.type === 'done') {
          tokenUsage = event.data.tokenUsage;
          // 流式完成后保存消息
          this.saveStreamedMessage(
            conversationId,
            event.data.content,
            contextData.citations || [],
            event.data.tokenUsage,
          ).catch((err) => this.logger.error('Failed to save streamed message:', err));

          // 如果是新对话，生成标题
          if (isNewConversation) {
            this.llm.generateTitle(dto.question).then((title) => {
              this.conversations.update(conversationId, { title }).catch((err) =>
                this.logger.error('Failed to update title:', err),
              );
            });
          }
        }
        return {
          data: {
            type: event.type,
            conversationId,
            ...event.data,
            citations: event.type === 'done' ? contextData.citations : undefined,
          },
        } as MessageEvent;
      }),
      catchError((error) => {
        this.logger.error(`Stream error: ${error.message}`);
        return of({
          data: {
            type: 'error',
            message: error.message,
          },
        } as MessageEvent);
      }),
    );
  }

  /**
   * 流式完成后保存消息
   */
  async saveStreamedMessage(
    conversationId: string,
    content: string,
    citations: any[],
    tokenUsage: any,
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
        citations,
        tokenUsage,
      },
    });

    await this.conversations.incrementTokens(
      conversationId,
      tokenUsage.totalTokens,
    );

    return message;
  }

  /**
   * 生成对话摘要
   */
  async summarizeConversation(conversationId: string) {
    const conversation = await this.conversations.findOne(conversationId);

    if (!conversation.messages || conversation.messages.length === 0) {
      return { summary: '暂无对话内容', keywords: [] };
    }

    // 构建对话文本
    const conversationText = (conversation.messages as any[])
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompts.summary },
      { role: 'user', content: `请为以下对话生成摘要：\n\n${conversationText}` },
    ];

    const response = await this.llm.chat(messages, { temperature: 0.3 });

    // 提取关键词
    const keywords = await this.extractKeywords(conversationText);

    // 更新对话
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary: response.content,
        keywords,
      },
    });

    return {
      summary: response.content,
      keywords,
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * 获取对话建议
   */
  async getSuggestions(conversationId: string) {
    const conversation = await this.conversations.findOne(conversationId);

    if (!conversation.messages || conversation.messages.length === 0) {
      return { suggestions: ['请先开始对话'] };
    }

    // 构建对话历史
    const historyText = (conversation.messages as any[])
      .slice(-10) // 最近 10 条
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompts.suggestion },
      {
        role: 'user',
        content: `基于以下对话历史，建议用户可能想问的下一个问题：\n\n${historyText}\n\n请直接输出 3 个建议，每行一个，不要编号。`,
      },
    ];

    const response = await this.llm.chat(messages, { temperature: 0.7 });

    const suggestions = response.content
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3);

    return { suggestions };
  }

  /**
   * 提取关键词
   */
  private async extractKeywords(text: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '从文本中提取 5 个最重要的关键词，直接输出关键词，用逗号分隔。',
      },
      { role: 'user', content: text.slice(0, 2000) },
    ];

    const response = await this.llm.chat(messages, { temperature: 0.3 });
    return response.content.split(/[,，、]/).map((k) => k.trim()).filter(k => k.length > 0).slice(0, 5);
  }
}
