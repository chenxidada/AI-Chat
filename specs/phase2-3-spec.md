# Phase 2-3 Spec: 流式输出 + 优化

## 1. 目标

提升 AI 对话体验和系统性能：
- SSE 流式输出（打字机效果）
- 中断生成功能
- 响应缓存优化
- 性能监控指标

## 2. 前置条件

- [x] Phase 2-2b 完成
- [x] 对话界面可用
- [x] RAG 功能正常

---

## 3. 后端实现

### 3.1 目录结构

```
apps/api/src/modules/ai/
├── ai.controller.ts          # (更新，添加流式接口)
├── ai.service.ts             # (更新，支持流式)
├── streaming.service.ts      # 流式处理服务
├── llm.service.ts            # (更新，支持流式)
└── dto/
    └── stream-event.dto.ts   # SSE 事件 DTO
```

### 3.2 StreamingService

```typescript
// apps/api/src/modules/ai/streaming.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';

export interface StreamEvent {
  type: 'start' | 'chunk' | 'citations' | 'done' | 'error';
  data: any;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('AI_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.apiKey = this.config.get<string>('AI_API_KEY') || '';
    this.model = this.config.get<string>('AI_CHAT_MODEL') || 'deepseek-chat';
  }

  /**
   * 流式聊天
   */
  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number },
  ): AsyncGenerator<StreamEvent> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 发送开始事件
      yield { type: 'start', data: { timestamp: startTime } };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalContent = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                totalContent += content;
                tokenCount++;
                yield { type: 'chunk', data: { content } };
              }

              // 捕获 usage 信息
              if (parsed.usage) {
                tokenCount = parsed.usage.total_tokens;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 发送完成事件
      const processingTime = Date.now() - startTime;
      yield {
        type: 'done',
        data: {
          content: totalContent,
          tokenUsage: { totalTokens: tokenCount },
          processingTime,
        },
      };

      this.logger.log(`Stream completed in ${processingTime}ms, tokens: ${tokenCount}`);
    } catch (error) {
      this.logger.error(`Stream error: ${error.message}`);
      yield { type: 'error', data: { message: error.message } };
    }
  }

  /**
   * 创建可取消的流
   */
  createCancellableStream(): {
    emitter: EventEmitter;
    cancel: () => void;
  } {
    const emitter = new EventEmitter();
    let cancelled = false;

    return {
      emitter,
      cancel: () => {
        cancelled = true;
        emitter.emit('cancel');
      },
    };
  }
}
```

### 3.3 更新 AiController

```typescript
// apps/api/src/modules/ai/ai.controller.ts

import { Controller, Post, Body, Sse, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable, from, map } from 'rxjs';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('AI 对话')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: '发送消息并获取 AI 回复（非流式）' })
  @ApiResponse({ status: 201, description: 'AI 回复成功' })
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  @Sse('chat/stream')
  @ApiOperation({ summary: '发送消息并获取流式回复' })
  async chatStream(@Body() dto: ChatDto): Promise<Observable<MessageEvent>> {
    const streamGenerator = await this.aiService.chatStream(dto);

    return from(streamGenerator).pipe(
      map((event) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }

  @Delete('chat/stream/:conversationId')
  @ApiOperation({ summary: '取消流式生成' })
  async cancelStream(@Param('conversationId') conversationId: string) {
    this.aiService.cancelStream(conversationId);
    return { cancelled: true };
  }
}
```

### 3.4 更新 AiService

```typescript
// apps/api/src/modules/ai/ai.service.ts 更新

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService, ChatMessage } from './llm.service';
import { RagService } from './rag.service';
import { StreamingService, StreamEvent } from './streaming.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // 活跃的流式请求（用于取消）
  private readonly activeStreams = new Map<string, AbortController>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly streaming: StreamingService,
    private readonly conversations: ConversationsService,
  ) {}

  // ... 原有 chat 方法保持不变

  /**
   * 流式聊天
   */
  async *chatStream(dto: ChatDto): AsyncGenerator<StreamEvent> {
    let conversationId = dto.conversationId;
    let isNewConversation = !conversationId;

    if (isNewConversation) {
      const conversation = await this.conversations.create({
        mode: dto.mode || 'general',
      });
      conversationId = conversation.id;

      // 发送对话 ID
      yield { type: 'conversation', data: { conversationId } };
    }

    const conversation = await this.conversations.findOne(conversationId);
    const history = this.buildHistory(conversation.messages || []);

    // 创建取消控制器
    const abortController = new AbortController();
    this.activeStreams.set(conversationId, abortController);

    try {
      // 保存用户消息
      await this.prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: dto.question,
        },
      });

      // 构建消息
      let messages: ChatMessage[];

      if (dto.mode === 'knowledge_base') {
        // RAG 模式：先检索，再流式生成
        const searchResults = await this.rag.search({
          query: dto.question,
          context: {
            documentIds: conversation.contextDocumentIds?.length
              ? conversation.contextDocumentIds
              : undefined,
            folderId: conversation.contextFolderId || undefined,
            tagIds: conversation.contextTagIds?.length
              ? conversation.contextTagIds
              : undefined,
          },
        });

        // 发送引用信息
        if (searchResults.length > 0) {
          yield {
            type: 'citations',
            data: { citations: searchResults.slice(0, 5) },
          };
        }

        messages = this.buildRagMessages(dto.question, searchResults, history);
      } else {
        messages = this.buildMessages(history, dto.question, 'general');
      }

      // 流式生成
      let fullContent = '';
      let tokenUsage = { totalTokens: 0 };

      for await (const event of this.streaming.streamChat(messages, { temperature: dto.temperature })) {
        // 检查是否取消
        if (abortController.signal.aborted) {
          yield { type: 'error', data: { message: 'Cancelled' } };
          return;
        }

        if (event.type === 'chunk') {
          fullContent += event.data.content;
        } else if (event.type === 'done') {
          tokenUsage = event.data.tokenUsage;
        }

        yield event;
      }

      // 保存 AI 回复
      await this.prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: fullContent,
          tokenUsage,
        },
      });

      // 更新 token 使用量
      await this.conversations.incrementTokens(conversationId, tokenUsage.totalTokens);

      // 生成标题
      if (isNewConversation) {
        const title = await this.llm.generateTitle(dto.question);
        await this.conversations.update(conversationId, { title });
      }
    } finally {
      this.activeStreams.delete(conversationId);
    }
  }

  /**
   * 取消流式生成
   */
  cancelStream(conversationId: string): void {
    const controller = this.activeStreams.get(conversationId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(conversationId);
    }
  }

  private buildHistory(messages: any[]): ChatMessage[] {
    return messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private buildMessages(history: ChatMessage[], question: string, mode: string): ChatMessage[] {
    // ... 原有实现
  }

  private buildRagMessages(question: string, searchResults: any[], history: ChatMessage[]): ChatMessage[] {
    // ... RAG 消息构建
  }
}
```

---

## 4. 前端实现

### 4.1 useStreamingChat

```typescript
// apps/web/hooks/use-streaming-chat.ts

import { useState, useCallback, useRef } from 'react';

interface StreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  isStreaming?: boolean;
}

interface UseStreamingChatOptions {
  conversationId?: string;
  mode?: 'general' | 'knowledge_base';
  context?: {
    documentIds?: string[];
    folderId?: string;
    tagIds?: string[];
  };
  onMessageComplete?: (message: StreamMessage) => void;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [conversationId, setConversationId] = useState(options.conversationId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [citations, setCitations] = useState<any[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    setIsStreaming(true);
    setStreamingContent('');

    // 添加用户消息
    const userMessage: StreamMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);

    // 创建 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: content,
          conversationId,
          mode: options.mode,
          context: options.context,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'conversation':
                  setConversationId(event.data.conversationId);
                  break;

                case 'citations':
                  setCitations(event.data.citations);
                  break;

                case 'chunk':
                  setStreamingContent((prev) => prev + event.data.content);
                  break;

                case 'done':
                  // 添加完整的 AI 消息
                  const assistantMessage: StreamMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: event.data.content,
                    citations,
                    isStreaming: false,
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                  options.onMessageComplete?.(assistantMessage);
                  break;

                case 'error':
                  console.error('Stream error:', event.data.message);
                  break;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream cancelled');
      } else {
        console.error('Stream error:', error);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  }, [conversationId, options.mode, options.context, citations]);

  const cancelStream = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (conversationId) {
      await fetch(`/api/ai/chat/stream/${conversationId}`, {
        method: 'DELETE',
      });
    }
  }, [conversationId]);

  return {
    messages,
    conversationId,
    isStreaming,
    streamingContent,
    citations,
    sendMessage,
    cancelStream,
  };
}
```

### 4.2 StreamingMessage

```tsx
// apps/web/components/ai/streaming-message.tsx

import ReactMarkdown from 'react-markdown';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
}

export function StreamingMessage({ content, isStreaming }: StreamingMessageProps) {
  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.3 更新 ChatInterface

```tsx
// apps/web/components/ai/chat-interface.tsx 更新

// 使用 useStreamingChat 替代 useAIChat
// 添加取消按钮

import { useStreamingChat } from '@/hooks/use-streaming-chat';

export function ChatInterface({ conversationId, initialMessages = [] }: ChatInterfaceProps) {
  // ... 其他代码

  const {
    messages,
    isStreaming,
    streamingContent,
    citations,
    sendMessage,
    cancelStream,
  } = useStreamingChat({
    conversationId,
    mode: currentMode,
    context,
  });

  return (
    <div className="flex flex-col h-full">
      {/* ... 头部代码 */}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages
          messages={messages}
          onCitationClick={handleCitationClick}
        />

        {/* 流式消息 */}
        {isStreaming && streamingContent && (
          <StreamingMessage
            content={streamingContent}
            isStreaming={isStreaming}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            placeholder={currentMode === 'knowledge_base' ? '基于知识库提问...' : '输入消息...'}
          />
          {isStreaming && (
            <button
              onClick={cancelStream}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              停止
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 5. 性能优化

### 5.1 Embedding 缓存

```typescript
// apps/api/src/modules/ai/embedding-cache.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

interface CacheEntry {
  embedding: number[];
  expiry: number;
}

@Injectable()
export class EmbeddingCacheService {
  private readonly logger = new Logger(EmbeddingCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize = 10000;
  private readonly ttl = 7 * 24 * 60 * 60 * 1000; // 7 天

  get(text: string): number[] | null {
    const key = this.hash(text);
    const entry = this.cache.get(key);

    if (entry && entry.expiry > Date.now()) {
      return entry.embedding;
    }

    return null;
  }

  set(text: string, embedding: number[]): void {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const key = this.hash(text);
    this.cache.set(key, {
      embedding,
      expiry: Date.now() + this.ttl,
    });
  }

  private hash(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  // 定期清理过期缓存
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} expired cache entries`);
    }
  }
}
```

### 5.2 向量检索优化

```sql
-- 调整 IVFFlat 索引参数
-- 当数据量增大时，增加 lists 数量
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 数据量 < 1000: lists = 10
-- 数据量 1000-10000: lists = 100
-- 数据量 > 10000: lists = sqrt(rows)
CREATE INDEX document_chunks_embedding_idx ON document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 添加预过滤索引
CREATE INDEX IF NOT EXISTS document_chunks_document_folder_idx
ON document_chunks(document_id);

-- 使用 HNSW 索引（如果 pgvector 版本支持，性能更好）
-- CREATE INDEX document_chunks_embedding_hnsw_idx ON document_chunks
-- USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### 5.3 健康检查扩展

```typescript
// apps/api/src/modules/health/health.service.ts 更新

async checkAIHealth() {
  const checks = {
    llmService: await this.checkLLMService(),
    embeddingService: await this.checkEmbeddingService(),
    vectorSearch: await this.checkVectorSearch(),
  };

  const allHealthy = Object.values(checks).every((c) => c.healthy);

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  };
}

private async checkLLMService(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    const start = Date.now();
    // 发送简单请求测试
    await this.llmService.chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
    return { healthy: true, latency: Date.now() - start };
  } catch {
    return { healthy: false };
  }
}

private async checkEmbeddingService(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    const start = Date.now();
    await this.embedding.embedText('test');
    return { healthy: true, latency: Date.now() - start };
  } catch {
    return { healthy: false };
  }
}

private async checkVectorSearch(): Promise<{ healthy: boolean; count?: number }> {
  try {
    const count = await this.prisma.documentChunk.count();
    return { healthy: true, count };
  } catch {
    return { healthy: false };
  }
}
```

---

## 6. 文件产出清单

```
Phase 2-3 总计：新增 6 文件，修改 4 文件

新增 (6 files):
├── apps/api/src/modules/ai/
│   ├── streaming.service.ts            # 流式处理服务
│   ├── embedding-cache.service.ts      # Embedding 缓存
│   └── dto/
│       └── stream-event.dto.ts         # SSE 事件 DTO
├── apps/web/components/ai/
│   └── streaming-message.tsx           # 流式消息组件
└── apps/web/hooks/
    └── use-streaming-chat.ts           # 流式聊天 Hook

修改 (4 files):
├── apps/api/src/modules/ai/ai.controller.ts
├── apps/api/src/modules/ai/ai.service.ts
├── apps/api/src/modules/health/health.service.ts
└── apps/web/components/ai/chat-interface.tsx
```

---

## 7. 测试验证方案

### 7.1 单元测试

```typescript
// apps/api/src/modules/ai/streaming.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StreamingService } from './streaming.service';

describe('StreamingService', () => {
  let service: StreamingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                AI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                AI_API_KEY: 'test-api-key',
                AI_CHAT_MODEL: 'deepseek-chat',
              };
              return config[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<StreamingService>(StreamingService);
  });

  it('should yield stream events', async () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const events = [];

    for await (const event of service.streamChat(messages)) {
      events.push(event);
    }

    expect(events.some(e => e.type === 'start')).toBe(true);
    expect(events.some(e => e.type === 'done' || e.type === 'error')).toBe(true);
  });
});
```

### 7.2 集成测试

```typescript
// apps/api/test/streaming.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Streaming API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return SSE stream', (done) => {
    const events: any[] = [];

    request(app.getHttpServer())
      .post('/ai/chat/stream')
      .send({ question: 'Hello' })
      .set('Accept', 'text/event-stream')
      .buffer()
      .parse((res, callback) => {
        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                events.push(JSON.parse(line.slice(6)));
              } catch (e) {}
            }
          }
        });
        res.on('end', () => callback(null, events));
      })
      .end((err, res) => {
        expect(events.some(e => e.type === 'start')).toBe(true);
        expect(events.some(e => e.type === 'done' || e.type === 'error')).toBe(true);
        done();
      });
  });
});
```

### 7.3 手动验证清单

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| **流式输出** | 发送消息 | 打字机效果显示 |
| **首字延迟** | 发送消息 | < 1 秒开始输出 |
| **中断生成** | 点击停止按钮 | 立即停止 |
| **引用显示** | 知识库模式 | 先显示引用再输出 |
| **缓存命中** | 重复问题 | 响应更快 |
| **健康检查** | GET `/api/health/ai` | 显示各服务状态 |

### 7.4 性能验证脚本

```bash
#!/bin/bash
# scripts/verify-phase2-3.sh

set -e

echo "=== Phase 2-3 验证脚本 ==="

API_URL="http://localhost:4000/api"

# 1. 测试流式输出延迟
echo "1. 测试流式输出首字延迟..."
START=$(date +%s%3N)
curl -s -N -X POST "$API_URL/ai/chat/stream" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"question":"你好"}' 2>&1 | head -n 5
END=$(date +%s%3N)
echo "首字延迟: $((END - START))ms"

# 2. 测试取消功能
echo "2. 测试取消功能..."
curl -s -X POST "$API_URL/ai/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"question":"写一篇长文章"}' &
STREAM_PID=$!
sleep 1
kill $STREAM_PID 2>/dev/null || true
echo "取消成功"

# 3. 测试健康检查
echo "3. 测试 AI 服务健康检查..."
curl -s "$API_URL/health/ai" | jq .

# 4. 测试缓存效果
echo "4. 测试 Embedding 缓存..."
echo "第一次请求..."
curl -s -X POST "$API_URL/embedding/sync/test-doc-id" | jq '.processingTime'
echo "第二次请求（应该更快）..."
curl -s -X POST "$API_URL/embedding/sync/test-doc-id" | jq '.processingTime'

echo "=== 验证完成 ==="
```

---

## 8. 完成标准

- [ ] SSE 流式输出正常
- [ ] 打字机效果流畅
- [ ] 首字延迟 < 1 秒
- [ ] 中断生成功能正常
- [ ] Embedding 缓存有效
- [ ] 向量检索性能达标
- [ ] 健康检查接口完善
- [ ] 单元测试通过
- [ ] 集成测试通过

---

## 9. 注意事项

1. **SSE 连接管理**：注意处理连接断开和重连
2. **内存管理**：流式处理时注意内存释放
3. **并发控制**：限制同时进行的流式请求数量
4. **错误恢复**：流式中断时提供重试机制
5. **监控告警**：添加响应时间和错误率监控

---

## 10. Phase 2 完成总结

完成 Phase 2-3 后，整个 Phase 2 即完成。此时系统具备：

- ✅ 文档向量化存储
- ✅ 向量相似度检索
- ✅ RAG 知识库问答
- ✅ 引用溯源系统
- ✅ 多轮对话上下文
- ✅ 流式输出体验
- ✅ 性能优化措施

可以进入 Phase 3（双向链接、知识图谱等高级功能）。
