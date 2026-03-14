import { Injectable, Logger } from '@nestjs/common';
import { LlmService, ChatMessage } from './llm.service';
import { VectorSearchService, SearchResult } from './vector-search.service';

export interface RagParams {
  question: string;
  conversationHistory?: ChatMessage[];
  context?: {
    documentIds?: string[];
    folderId?: string;
    tagIds?: string[];
  };
  temperature?: number;
}

export interface RagResponse {
  answer: string;
  citations: Citation[];
  relevantChunks: RelevantChunk[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTime: number;
}

export interface Citation {
  id: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}

export interface RelevantChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkText: string;
  heading: string | null;
  similarity: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  // RAG 系统提示词
  private readonly ragSystemPrompt = `你是一个专业的个人知识库助手。请基于以下参考资料回答问题。

## 参考资料
{context}

## 回答要求
1. 严格基于提供的参考资料，不要编造信息
2. 在回答中引用资料来源，使用格式 [1]、[2] 对应参考资料编号
3. 如果资料中没有相关信息，请说明"根据提供的资料，没有找到相关信息"
4. 保持回答简洁专业，使用 Markdown 格式组织内容
5. 引用标记应该紧跟相关内容之后`;

  constructor(
    private readonly llm: LlmService,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  /**
   * RAG 问答
   */
  async generateAnswer(params: RagParams): Promise<RagResponse> {
    const startTime = Date.now();

    try {
      // 1. 检索相关文档块
      const searchResults = await this.vectorSearch.search({
        query: params.question,
        limit: 8,
        threshold: 0.7,
        ...params.context,
      });

      this.logger.log(`Found ${searchResults.length} relevant chunks`);

      // 2. 如果没有相关文档，返回提示
      if (searchResults.length === 0) {
        return {
          answer:
            '根据提供的资料，没有找到与您问题相关的信息。您可以尝试：\n1. 换一种方式提问\n2. 扩大搜索范围\n3. 切换到通用对话模式',
          citations: [],
          relevantChunks: [],
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          processingTime: Date.now() - startTime,
        };
      }

      // 3. 构建上下文
      const context = this.buildContext(searchResults);

      // 4. 构建消息列表
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: this.ragSystemPrompt.replace('{context}', context),
        },
        ...(params.conversationHistory || []),
        { role: 'user', content: params.question },
      ];

      // 5. 调用 LLM
      const response = await this.llm.chat(messages, {
        temperature: params.temperature ?? 0.7,
      });

      // 6. 提取引用
      const citations = this.extractCitations(response.content, searchResults);

      // 7. 构建响应
      return {
        answer: response.content,
        citations,
        relevantChunks: searchResults.slice(0, 5).map((r) => ({
          chunkId: r.id,
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          chunkText: r.chunkText,
          heading: r.heading,
          similarity: r.similarity,
        })),
        tokenUsage: response.tokenUsage,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`RAG failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 构建上下文字符串
   */
  private buildContext(results: SearchResult[]): string {
    return results
      .map((r, index) => {
        const heading = r.heading ? `【${r.heading}】\n` : '';
        return `[${index + 1}] ${heading}${r.chunkText}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * 从回答中提取引用
   */
  private extractCitations(
    answer: string,
    results: SearchResult[],
  ): Citation[] {
    const citations: Citation[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let match;

    while ((match = citationRegex.exec(answer)) !== null) {
      const index = parseInt(match[1]) - 1;
      if (index >= 0 && index < results.length) {
        const result = results[index];

        // 避免重复引用
        if (!citations.find((c) => c.chunkId === result.id)) {
          citations.push({
            id: `cite-${citations.length + 1}`,
            chunkId: result.id,
            documentId: result.documentId,
            documentTitle: result.documentTitle,
            excerpt: this.getExcerpt(result.chunkText, 150),
            similarity: result.similarity,
          });
        }
      }
    }

    return citations;
  }

  /**
   * 获取文本摘要
   */
  private getExcerpt(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // 尝试在句子边界截断
    const truncated = text.slice(0, maxLength);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？'),
    );

    if (lastPeriod > maxLength * 0.5) {
      return truncated.slice(0, lastPeriod + 1);
    }

    return truncated + '...';
  }

  /**
   * 仅检索上下文（不生成答案）
   */
  async retrieveContext(params: {
    question: string;
    context?: {
      documentIds?: string[];
      folderId?: string;
      tagIds?: string[];
    };
  }): Promise<{ context: string; citations: Citation[] }> {
    // 1. 检索相关文档块
    const searchResults = await this.vectorSearch.search({
      query: params.question,
      limit: 8,
      threshold: 0.7,
      ...params.context,
    });

    if (searchResults.length === 0) {
      return { context: '没有找到相关资料', citations: [] };
    }

    // 2. 构建上下文
    const context = this.buildContext(searchResults);

    // 3. 构建引用列表
    const citations: Citation[] = searchResults.slice(0, 5).map((r, index) => ({
      id: `cite-${index + 1}`,
      chunkId: r.id,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      excerpt: this.getExcerpt(r.chunkText, 150),
      similarity: r.similarity,
    }));

    return { context, citations };
  }
}
