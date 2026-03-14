# Phase 2-2a Spec: 向量检索 + RAG 引擎

## 1. 目标

实现完整的 RAG（检索增强生成）流程：
- 文档分块策略和流水线
- 向量化批量处理
- pgvector 相似度搜索
- RAG 提示词工程

## 2. 前置条件

- [x] Phase 2-1b 完成
- [x] document_chunks 表可用
- [x] EmbeddingService 可用
- [x] LlmService 可用

---

## 3. 文档分块策略

### 3.1 分块规则

| 参数 | 值 | 说明 |
|------|-----|------|
| **chunk_size** | 500 | 每块最大字符数 |
| **chunk_overlap** | 100 | 块之间重叠字符数 |
| **min_chunk_size** | 100 | 最小块大小（小于此值合并到上一块） |
| **separator** | `\n\n` | 优先分割符（段落） |
| **secondary_separator** | `\n` | 次级分割符（行） |

### 3.2 分块算法

```typescript
// apps/api/src/modules/ai/chunking.service.ts

import { Injectable, Logger } from '@nestjs/common';

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
}

export interface DocumentChunkData {
  chunkIndex: number;
  chunkText: string;
  heading: string | null;
  tokenCount: number;
  contentHash: string;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  private readonly defaultOptions: Required<ChunkOptions> = {
    chunkSize: 500,
    chunkOverlap: 100,
    minChunkSize: 100,
  };

  /**
   * 将文档内容分块
   */
  chunkDocument(content: string, options?: ChunkOptions): DocumentChunkData[] {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: DocumentChunkData[] = [];

    // 1. 按标题分割（Markdown 标题）
    const sections = this.splitByHeadings(content);

    // 2. 对每个部分进行分块
    let chunkIndex = 0;
    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, opts);

      for (const chunk of sectionChunks) {
        chunks.push({
          chunkIndex: chunkIndex++,
          chunkText: chunk.text,
          heading: section.heading,
          tokenCount: this.estimateTokens(chunk.text),
          contentHash: this.hashContent(chunk.text),
        });
      }
    }

    this.logger.log(`Document chunked into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * 按标题分割文档
   */
  private splitByHeadings(content: string): Array<{ heading: string | null; content: string }> {
    const sections: Array<{ heading: string | null; content: string }> = [];

    // 匹配 Markdown 标题 (# ## ### 等)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];

    if (matches.length === 0) {
      // 没有标题，整体作为一个部分
      return [{ heading: null, content }];
    }

    // 第一个标题之前的内容
    if (matches[0].index! > 0) {
      sections.push({
        heading: null,
        content: content.slice(0, matches[0].index).trim(),
      });
    }

    // 按标题分割
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const headingLevel = match[1].length;
      const headingText = match[2].trim();
      const startIndex = match.index! + match[0].length;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;

      sections.push({
        heading: `${'#'.repeat(headingLevel)} ${headingText}`,
        content: content.slice(startIndex, endIndex).trim(),
      });
    }

    return sections;
  }

  /**
   * 对一个部分进行分块
   */
  private chunkSection(
    section: { heading: string | null; content: string },
    opts: Required<ChunkOptions>,
  ): Array<{ text: string }> {
    const chunks: Array<{ text: string }> = [];
    const text = section.heading
      ? `${section.heading}\n\n${section.content}`
      : section.content;

    if (text.length <= opts.chunkSize) {
      return [{ text }];
    }

    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // 如果单个段落超过块大小，需要进一步分割
      if (paragraph.length > opts.chunkSize) {
        // 先保存当前块
        if (currentChunk.length >= opts.minChunkSize) {
          chunks.push({ text: currentChunk.trim() });
          currentChunk = '';
        }

        // 按行分割大段落
        const lines = paragraph.split('\n');
        for (const line of lines) {
          if (currentChunk.length + line.length + 1 <= opts.chunkSize) {
            currentChunk += (currentChunk ? '\n' : '') + line;
          } else {
            if (currentChunk.length >= opts.minChunkSize) {
              chunks.push({ text: currentChunk.trim() });
            }
            currentChunk = line;
          }
        }
      } else {
        // 检查是否需要开始新块
        if (currentChunk.length + paragraph.length + 2 > opts.chunkSize) {
          if (currentChunk.length >= opts.minChunkSize) {
            chunks.push({ text: currentChunk.trim() });
            // 保留重叠部分
            currentChunk = this.getOverlap(currentChunk, opts.chunkOverlap) + '\n\n' + paragraph;
          } else {
            currentChunk += '\n\n' + paragraph;
          }
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
    }

    // 保存最后一块
    if (currentChunk.trim().length >= opts.minChunkSize) {
      chunks.push({ text: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * 获取文本末尾的重叠部分
   */
  private getOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) return text;

    // 尝试在句子边界截断
    const lastPeriod = text.lastIndexOf('。', overlapSize);
    const lastNewline = text.lastIndexOf('\n', overlapSize);
    const cutPoint = Math.max(lastPeriod, lastNewline);

    if (cutPoint > 0) {
      return text.slice(cutPoint + 1).trim();
    }

    return text.slice(-overlapSize);
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 计算内容哈希
   */
  private hashContent(text: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text).digest('hex');
  }
}
```

---

## 4. 向量检索服务

### 4.1 VectorSearchService

```typescript
// apps/api/src/modules/ai/vector-search.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface VectorSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
  documentIds?: string[];
  folderId?: string;
  tagIds?: string[];
}

export interface SearchResult {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  chunkText: string;
  heading: string | null;
  similarity: number;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * 向量相似度搜索
   */
  async search(params: VectorSearchParams): Promise<SearchResult[]> {
    const {
      query,
      limit = 8,
      threshold = 0.7,
      documentIds,
      folderId,
      tagIds,
    } = params;

    const startTime = Date.now();

    // 1. 获取查询向量
    const { embedding: queryEmbedding } = await this.embedding.embedText(query);

    // 2. 构建过滤条件
    const filters = this.buildFilters({ documentIds, folderId, tagIds });

    // 3. 执行向量搜索
    const results = await this.executeSearch(queryEmbedding, limit, threshold, filters);

    this.logger.log(`Vector search completed in ${Date.now() - startTime}ms, found ${results.length} results`);

    return results;
  }

  /**
   * 构建过滤条件
   */
  private buildFilters(params: {
    documentIds?: string[];
    folderId?: string;
    tagIds?: string[];
  }): string {
    const conditions: string[] = ['d.is_archived = false'];

    if (params.documentIds?.length) {
      const ids = params.documentIds.map(id => `'${id}'`).join(',');
      conditions.push(`dc.document_id IN (${ids})`);
    }

    if (params.folderId) {
      conditions.push(`d.folder_id = '${params.folderId}'`);
    }

    if (params.tagIds?.length) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM document_tags dt
          WHERE dt.document_id = d.id
          AND dt.tag_id IN (${params.tagIds.map(id => `'${id}'`).join(',')})
        )
      `);
    }

    return conditions.join(' AND ');
  }

  /**
   * 执行向量搜索 SQL
   */
  private async executeSearch(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
    filters: string,
  ): Promise<SearchResult[]> {
    // 将向量转换为字符串格式
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const sql = `
      SELECT
        dc.id,
        dc.document_id as "documentId",
        dc.chunk_index as "chunkIndex",
        dc.chunk_text as "chunkText",
        dc.heading,
        d.title as "documentTitle",
        1 - (dc.embedding <=> $1::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE ${filters}
        AND 1 - (dc.embedding <=> $1::vector) > $2
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $3
    `;

    const results = await this.prisma.$queryRawUnsafe<SearchResult[]>(
      sql,
      vectorStr,
      threshold,
      limit,
    );

    return results;
  }

  /**
   * 混合搜索：向量 + 关键词
   */
  async hybridSearch(params: VectorSearchParams & { keyword?: string }): Promise<SearchResult[]> {
    const { keyword, ...vectorParams } = params;

    if (!keyword) {
      return this.search(vectorParams);
    }

    // 并行执行向量搜索和关键词搜索
    const [vectorResults, keywordResults] = await Promise.all([
      this.search(vectorParams),
      this.keywordSearch(keyword, vectorParams),
    ]);

    // 合并结果并去重
    const mergedMap = new Map<string, SearchResult>();

    // 向量搜索结果权重 0.7
    for (const result of vectorResults) {
      mergedMap.set(result.id, { ...result, similarity: result.similarity * 0.7 });
    }

    // 关键词搜索结果权重 0.3
    for (const result of keywordResults) {
      if (mergedMap.has(result.id)) {
        const existing = mergedMap.get(result.id)!;
        mergedMap.set(result.id, {
          ...existing,
          similarity: existing.similarity + result.similarity * 0.3,
        });
      } else {
        mergedMap.set(result.id, { ...result, similarity: result.similarity * 0.3 });
      }
    }

    // 按相似度排序
    return Array.from(mergedMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, vectorParams.limit || 8);
  }

  /**
   * 关键词搜索（使用 Meilisearch 或数据库 LIKE）
   */
  private async keywordSearch(
    keyword: string,
    params: VectorSearchParams,
  ): Promise<SearchResult[]> {
    // 简化实现：使用数据库 LIKE 搜索
    const results = await this.prisma.documentChunk.findMany({
      where: {
        chunkText: { contains: keyword, mode: 'insensitive' },
        document: { isArchived: false },
      },
      take: params.limit || 8,
      include: {
        document: {
          select: { id: true, title: true },
        },
      },
    });

    return results.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      documentTitle: r.document.title,
      chunkIndex: r.chunkIndex,
      chunkText: r.chunkText,
      heading: r.heading,
      similarity: 0.5, // 关键词匹配给予固定相似度
    }));
  }
}
```

---

## 5. RAG 服务

### 5.1 RagService

```typescript
// apps/api/src/modules/ai/rag.service.ts

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
          answer: '根据提供的资料，没有找到与您问题相关的信息。您可以尝试：\n1. 换一种方式提问\n2. 扩大搜索范围\n3. 切换到通用对话模式',
          citations: [],
          relevantChunks: [],
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
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
  private extractCitations(answer: string, results: SearchResult[]): Citation[] {
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
}
```

---

## 6. 向量化同步服务

### 6.1 EmbeddingSyncService

```typescript
// apps/api/src/modules/embedding/embedding-sync.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChunkingService } from '../ai/chunking.service';
import { EmbeddingService } from '../ai/embedding.service';

export interface SyncStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalChunks: number;
  processedChunks: number;
  error?: string;
}

@Injectable()
export class EmbeddingSyncService {
  private readonly logger = new Logger(EmbeddingSyncService.name);

  // 正在处理的文档
  private readonly processingDocs = new Map<string, SyncStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * 同步单个文档
   */
  async syncDocument(documentId: string): Promise<SyncStatus> {
    // 检查是否正在处理
    if (this.processingDocs.has(documentId)) {
      return this.processingDocs.get(documentId)!;
    }

    const status: SyncStatus = {
      documentId,
      status: 'processing',
      totalChunks: 0,
      processedChunks: 0,
    };
    this.processingDocs.set(documentId, status);

    try {
      // 1. 获取文档
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (document.isArchived) {
        throw new Error(`Document ${documentId} is archived`);
      }

      // 2. 分块
      const chunks = this.chunking.chunkDocument(document.content);
      status.totalChunks = chunks.length;

      this.logger.log(`Document ${documentId} chunked into ${chunks.length} chunks`);

      // 3. 删除旧的分块
      await this.prisma.documentChunk.deleteMany({
        where: { documentId },
      });

      // 4. 批量向量化并保存
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // 获取向量
        const { embedding } = await this.embedding.embedText(chunk.chunkText);

        // 保存到数据库
        await this.prisma.documentChunk.create({
          data: {
            documentId,
            chunkIndex: chunk.chunkIndex,
            chunkText: chunk.chunkText,
            heading: chunk.heading,
            tokenCount: chunk.tokenCount,
            embedding: `[${embedding.join(',')}]` as any,
            contentHash: chunk.contentHash,
          },
        });

        status.processedChunks = i + 1;
        this.processingDocs.set(documentId, { ...status });
      }

      status.status = 'completed';
      this.processingDocs.delete(documentId);

      this.logger.log(`Document ${documentId} sync completed`);

      return status;
    } catch (error) {
      status.status = 'failed';
      status.error = error.message;
      this.processingDocs.delete(documentId);

      this.logger.error(`Document ${documentId} sync failed: ${error.message}`);

      return status;
    }
  }

  /**
   * 同步所有文档
   */
  async syncAll(): Promise<{ total: number; completed: number; failed: number }> {
    const documents = await this.prisma.document.findMany({
      where: { isArchived: false },
      select: { id: true },
    });

    let completed = 0;
    let failed = 0;

    for (const doc of documents) {
      try {
        const status = await this.syncDocument(doc.id);
        if (status.status === 'completed') {
          completed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        this.logger.error(`Failed to sync document ${doc.id}: ${error.message}`);
      }
    }

    return { total: documents.length, completed, failed };
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(documentId: string): SyncStatus | null {
    return this.processingDocs.get(documentId) || null;
  }

  /**
   * 删除文档的向量数据
   */
  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    this.logger.log(`Deleted chunks for document ${documentId}`);
  }
}
```

### 6.2 EmbeddingController

```typescript
// apps/api/src/modules/embedding/embedding.controller.ts

import { Controller, Post, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmbeddingSyncService } from './embedding-sync.service';

@ApiTags('向量化')
@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly syncService: EmbeddingSyncService) {}

  @Post('sync/:documentId')
  @ApiOperation({ summary: '同步单个文档的向量' })
  @ApiResponse({ status: 200, description: '同步状态' })
  async syncDocument(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.syncService.syncDocument(documentId);
  }

  @Post('sync-all')
  @ApiOperation({ summary: '同步所有文档的向量' })
  @ApiResponse({ status: 200, description: '同步结果' })
  async syncAll() {
    return this.syncService.syncAll();
  }

  @Get('status/:documentId')
  @ApiOperation({ summary: '获取文档同步状态' })
  @ApiResponse({ status: 200, description: '同步状态' })
  getStatus(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.syncService.getSyncStatus(documentId) || { status: 'not_found' };
  }
}
```

---

## 7. 更新 AiService 集成 RAG

```typescript
// apps/api/src/modules/ai/ai.service.ts 更新

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService, ChatMessage } from './llm.service';
import { RagService } from './rag.service';
import { EmbeddingSyncService } from '../embedding/embedding-sync.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly embeddingSync: EmbeddingSyncService,
    private readonly conversations: ConversationsService,
  ) {}

  async chat(dto: ChatDto) {
    let conversationId = dto.conversationId;
    let isNewConversation = !conversationId;

    if (isNewConversation) {
      const conversation = await this.conversations.create({
        mode: dto.mode || 'general',
      });
      conversationId = conversation.id;
    }

    const conversation = await this.conversations.findOne(conversationId);
    const history = this.buildHistory(conversation.messages || []);

    let response: { answer: string; tokenUsage: any; citations?: any[] };

    // 根据模式选择处理方式
    if (dto.mode === 'knowledge_base') {
      // RAG 模式
      const ragResponse = await this.rag.generateAnswer({
        question: dto.question,
        conversationHistory: history,
        context: {
          documentIds: conversation.contextDocumentIds?.length
            ? conversation.contextDocumentIds
            : undefined,
          folderId: conversation.contextFolderId || undefined,
          tagIds: conversation.contextTagIds?.length
            ? conversation.contextTagIds
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

    // 保存消息
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

    await this.conversations.incrementTokens(
      conversationId,
      response.tokenUsage.totalTokens,
    );

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

  private buildHistory(messages: any[]): ChatMessage[] {
    return messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private buildMessages(
    history: ChatMessage[],
    question: string,
    mode: 'general' | 'knowledge_base',
  ): ChatMessage[] {
    // ... 保持原有实现
  }
}
```

---

## 8. 文件产出清单

```
Phase 2-2a 总计：新增 10 文件，修改 3 文件

新增 (10 files):
├── apps/api/src/modules/ai/
│   ├── chunking.service.ts             # 文档分块服务
│   ├── rag.service.ts                  # RAG 引擎
│   ├── vector-search.service.ts        # 向量检索服务
│   └── dto/
│       └── rag-query.dto.ts            # RAG 查询 DTO
├── apps/api/src/modules/embedding/
│   ├── embedding.module.ts             # 向量化模块
│   ├── embedding.controller.ts         # 向量化 API
│   ├── embedding-sync.service.ts       # 同步服务
│   └── dto/
│       └── sync-status.dto.ts          # 状态 DTO
└── packages/shared/src/types/
    └── embedding.ts                    # Embedding 类型

修改 (3 files):
├── apps/api/src/modules/ai/ai.module.ts
├── apps/api/src/modules/ai/ai.service.ts
└── apps/api/src/app.module.ts
```

---

## 9. 测试验证方案

### 9.1 单元测试

```typescript
// apps/api/src/modules/ai/chunking.service.spec.ts

import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  it('should chunk simple text', () => {
    const content = '这是第一段。\n\n这是第二段。';
    const chunks = service.chunkDocument(content);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunkText).toContain('第一段');
  });

  it('should respect chunk size limit', () => {
    const content = 'a'.repeat(1000);
    const chunks = service.chunkDocument(content, { chunkSize: 500 });

    for (const chunk of chunks) {
      expect(chunk.chunkText.length).toBeLessThanOrEqual(600); // 允许一些重叠
    }
  });

  it('should split by headings', () => {
    const content = `# 标题一

内容一

## 标题二

内容二`;

    const chunks = service.chunkDocument(content);

    expect(chunks.some(c => c.heading?.includes('标题一'))).toBe(true);
    expect(chunks.some(c => c.heading?.includes('标题二'))).toBe(true);
  });
});
```

```typescript
// apps/api/src/modules/ai/vector-search.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingService } from './embedding.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('VectorSearchService', () => {
  let service: VectorSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorSearchService,
        {
          provide: EmbeddingService,
          useValue: {
            embedText: jest.fn().mockResolvedValue({
              embedding: new Array(1024).fill(0.1),
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockResolvedValue([
              {
                id: 'chunk-1',
                documentId: 'doc-1',
                documentTitle: 'Test Doc',
                chunkIndex: 0,
                chunkText: 'Test content',
                heading: null,
                similarity: 0.85,
              },
            ]),
          },
        },
      ],
    }).compile();

    service = module.get<VectorSearchService>(VectorSearchService);
  });

  it('should return search results', async () => {
    const results = await service.search({
      query: 'test query',
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].similarity).toBeGreaterThan(0.7);
  });
});
```

### 9.2 集成测试

```typescript
// apps/api/test/rag.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('RAG API (e2e)', () => {
  let app: INestApplication;
  let documentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 创建测试文档
    const docRes = await request(app.getHttpServer())
      .post('/documents')
      .send({
        title: 'RAG 测试文档',
        content: `
# 知识管理概述

知识管理是一种系统化的方法，用于创建、捕获、存储和分享知识。

## 知识管理的类型

1. 显性知识：可以文档化的知识
2. 隐性知识：个人经验和技能

## 知识管理工具

常用的知识管理工具包括：
- 文档管理系统
- 知识图谱
- AI 助手
        `,
      });

    documentId = docRes.body.id;

    // 同步向量化
    await request(app.getHttpServer())
      .post(`/embedding/sync/${documentId}`);
  });

  afterAll(async () => {
    // 清理测试数据
    if (documentId) {
      await request(app.getHttpServer()).delete(`/documents/${documentId}`);
    }
    await app.close();
  });

  describe('RAG 问答', () => {
    it('should answer question based on knowledge base', () => {
      return request(app.getHttpServer())
        .post('/ai/chat')
        .send({
          question: '知识管理有哪些类型？',
          mode: 'knowledge_base',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.answer).toBeDefined();
          expect(res.body.citations).toBeDefined();
          expect(res.body.citations.length).toBeGreaterThan(0);
        });
    });

    it('should include citations in response', () => {
      return request(app.getHttpServer())
        .post('/ai/chat')
        .send({
          question: '什么是显性知识？',
          mode: 'knowledge_base',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.answer).toContain('['); // 包含引用标记
        });
    });
  });
});
```

### 9.3 手动验证清单

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| **文档分块** | 创建长文档 | 正确分割为多个 chunk |
| **向量化同步** | POST `/embedding/sync/:id` | 返回处理状态 |
| **向量检索** | 发送知识库问题 | 返回相关 chunks |
| **RAG 问答** | POST `/ai/chat` mode=knowledge_base | 回答包含引用 |
| **引用准确性** | 检查 citations | 文档 ID、标题正确 |
| **无结果处理** | 问无关问题 | 提示无相关信息 |

### 9.4 验证脚本

```bash
#!/bin/bash
# scripts/verify-phase2-2a.sh

set -e

echo "=== Phase 2-2a 验证脚本 ==="

API_URL="http://localhost:4000/api"

# 1. 创建测试文档
echo "1. 创建测试文档..."
DOC_RESPONSE=$(curl -s -X POST "$API_URL/documents" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "RAG 测试文档",
    "content": "# 知识管理\n\n知识管理是一种系统化的方法。\n\n## 类型\n\n1. 显性知识\n2. 隐性知识"
  }')
DOC_ID=$(echo $DOC_RESPONSE | jq -r '.id')
echo "文档 ID: $DOC_ID"

# 2. 同步向量化
echo "2. 同步向量化..."
curl -s -X POST "$API_URL/embedding/sync/$DOC_ID" | jq .

# 3. 检查 chunks
echo "3. 检查数据库 chunks..."
docker exec kb-postgres psql -U kb_user -d knowledge_base \
  -c "SELECT id, chunk_index, LEFT(chunk_text, 50) as preview FROM document_chunks WHERE document_id = '$DOC_ID'"

# 4. 测试向量检索
echo "4. 测试 RAG 问答..."
curl -s -X POST "$API_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"question":"知识管理有哪些类型？","mode":"knowledge_base"}' | jq '{
    answer: .answer[0:200],
    citations: .citations
  }'

# 5. 清理
echo "5. 清理测试数据..."
curl -s -X DELETE "$API_URL/documents/$DOC_ID"

echo "=== 验证完成 ==="
```

---

## 10. 完成标准

- [ ] ChunkingService 正确分割文档
- [ ] EmbeddingSyncService 可同步文档向量
- [ ] VectorSearchService 向量检索准确
- [ ] RagService 可生成带引用的回答
- [ ] 知识库模式 AI 对话可用
- [ ] 引用信息正确（文档 ID、标题、摘要）
- [ ] 无相关结果时正确提示
- [ ] 单元测试通过
- [ ] 集成测试通过

---

## 11. 注意事项

1. **分块策略调优**：根据实际文档类型调整 chunk_size 和 overlap
2. **向量索引维护**：大量数据时考虑调整 IVFFlat 参数
3. **并发控制**：向量化是 CPU 密集操作，控制并发数
4. **错误恢复**：向量化失败时应支持重试
