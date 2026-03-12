# Phase 2-1b Spec: 基础 AI 对话

## 1. 目标

实现基础的 AI 对话功能（通用模式），不涉及 RAG，直接调用 LLM API：
- 对话 CRUD API 完整实现
- AI 对话接口（非流式）
- 消息存储和上下文管理
- 前端基础对话界面

## 2. 前置条件

- [x] Phase 2-1a 完成
- [x] 阿里云百炼 API 可用
- [x] ConversationsService 基础功能可用

---

## 3. 后端实现

### 3.1 目录结构

```
apps/api/src/modules/
├── ai/
│   ├── ai.module.ts
│   ├── ai.controller.ts          # AI 对话 API
│   ├── ai.service.ts             # AI 对话服务
│   ├── llm.service.ts            # LLM API 封装
│   ├── embedding.service.ts      # (已有)
│   └── dto/
│       ├── chat.dto.ts
│       └── create-conversation.dto.ts
├── conversations/
│   ├── conversations.module.ts
│   ├── conversations.service.ts  # (已有，扩展)
│   ├── conversations.controller.ts
│   └── dto/
│       ├── query-conversation.dto.ts
│       └── update-conversation.dto.ts
```

### 3.2 LlmService 实现

```typescript
// apps/api/src/modules/ai/llm.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('AI_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.apiKey = this.config.get<string>('AI_API_KEY') || '';
    this.model = this.config.get<string>('AI_CHAT_MODEL') || 'deepseek-chat';
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatCompletionResponse> {
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
          max_tokens: options?.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      this.logger.log(`LLM response in ${processingTime}ms, tokens: ${data.usage?.total_tokens}`);

      return {
        content: data.choices[0].message.content,
        tokenUsage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || this.model,
      };
    } catch (error) {
      this.logger.error(`LLM request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成对话标题
   */
  async generateTitle(firstMessage: string): Promise<string> {
    const response = await this.chat(
      [
        {
          role: 'system',
          content: '请用简短的一句话（不超过20个字）概括以下对话的主题，直接输出标题，不要加引号或其他符号。',
        },
        {
          role: 'user',
          content: firstMessage,
        },
      ],
      { temperature: 0.3, maxTokens: 50 },
    );

    return response.content.trim().slice(0, 50);
  }
}
```

### 3.3 AiService 实现

```typescript
// apps/api/src/modules/ai/ai.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService } from './llm.service';
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
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * 发送消息并获取 AI 回复
   */
  async chat(dto: ChatDto) {
    // 1. 获取或创建对话
    let conversationId = dto.conversationId;
    let isNewConversation = !conversationId;

    if (isNewConversation) {
      const conversation = await this.conversations.create({
        mode: dto.mode || 'general',
      });
      conversationId = conversation.id;
    }

    // 2. 获取对话历史
    const conversation = await this.conversations.findOne(conversationId);
    const history = conversation.messages || [];

    // 3. 构建消息列表
    const messages = this.buildMessages(history, dto.question, dto.mode || 'general');

    // 4. 调用 LLM
    const response = await this.llm.chat(messages, {
      temperature: dto.temperature,
    });

    // 5. 保存用户消息
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: dto.question,
      },
    });

    // 6. 保存 AI 回复
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: response.content,
        tokenUsage: response.tokenUsage,
        model: response.model,
      },
    });

    // 7. 更新对话 token 使用量
    await this.conversations.incrementTokens(conversationId, response.tokenUsage.totalTokens);

    // 8. 如果是新对话，生成标题
    if (isNewConversation) {
      const title = await this.llm.generateTitle(dto.question);
      await this.conversations.update(conversationId, { title });
    }

    return {
      conversationId,
      messageId: assistantMessage.id,
      answer: response.content,
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    history: any[],
    question: string,
    mode: 'general' | 'knowledge_base',
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // 系统提示词
    messages.push({
      role: 'system',
      content: this.systemPrompts[mode],
    });

    // 历史消息（保留最近 10 轮）
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
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
```

### 3.4 AiController 实现

```typescript
// apps/api/src/modules/ai/ai.controller.ts

import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('AI 对话')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: '发送消息并获取 AI 回复' })
  @ApiResponse({ status: 201, description: 'AI 回复成功' })
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }
}
```

### 3.5 ConversationsController 实现

```typescript
// apps/api/src/modules/conversations/conversations.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';

@ApiTags('对话')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: '创建新对话' })
  @ApiResponse({ status: 201, description: '对话创建成功' })
  create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取对话列表' })
  @ApiResponse({ status: 200, description: '对话列表' })
  findAll(@Query() query: QueryConversationDto) {
    return this.conversationsService.findAll({
      page: query.page,
      limit: query.limit,
      isArchived: query.isArchived === 'true',
      mode: query.mode,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取对话详情' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '对话详情' })
  @ApiResponse({ status: 404, description: '对话不存在' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新对话' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '对话更新成功' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除对话' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '对话已删除' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.remove(id);
  }
}
```

### 3.6 DTO 定义

```typescript
// apps/api/src/modules/ai/dto/chat.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  Max,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ChatDto {
  @ApiProperty({ description: '用户问题', minLength: 1 })
  @IsString()
  @MinLength(1)
  question: string;

  @ApiPropertyOptional({ description: '对话 ID，不提供则创建新对话' })
  @IsOptional()
  @IsUUID('4')
  conversationId?: string;

  @ApiPropertyOptional({
    description: '对话模式',
    enum: ['general', 'knowledge_base'],
    default: 'general',
  })
  @IsOptional()
  @IsIn(['general', 'knowledge_base'])
  mode?: string;

  @ApiPropertyOptional({ description: '温度参数', minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;
}
```

```typescript
// apps/api/src/modules/conversations/dto/query-conversation.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryConversationDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: '是否归档', enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  isArchived?: string;

  @ApiPropertyOptional({ description: '对话模式', enum: ['general', 'knowledge_base'] })
  @IsOptional()
  @IsIn(['general', 'knowledge_base'])
  mode?: string;
}
```

```typescript
// apps/api/src/modules/conversations/dto/update-conversation.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsArray, IsUUID } from 'class-validator';

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: '对话标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '是否归档' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: '上下文文档 IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contextDocumentIds?: string[];

  @ApiPropertyOptional({ description: '上下文文件夹 ID' })
  @IsOptional()
  @IsUUID('4')
  contextFolderId?: string;

  @ApiPropertyOptional({ description: '上下文标签 IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contextTagIds?: string[];
}
```

### 3.7 模块更新

```typescript
// apps/api/src/modules/ai/ai.module.ts

import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { EmbeddingService } from './embedding.service';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [AiController],
  providers: [AiService, LlmService, EmbeddingService],
  exports: [AiService, LlmService, EmbeddingService],
})
export class AiModule {}
```

```typescript
// apps/api/src/modules/conversations/conversations.module.ts

import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
```

---

## 4. 前端实现

### 4.1 目录结构

```
apps/web/
├── hooks/
│   └── use-conversations.ts      # 对话数据 Hook
├── stores/
│   └── conversation-store.ts     # 对话状态管理
└── lib/
    └── api-client.ts             # (已有，扩展)
```

### 4.2 API Client 扩展

```typescript
// apps/web/lib/api-client.ts 扩展

// ... 原有代码

// ============================================
// AI 对话 API
// ============================================

export const conversationsApi = {
  list: (params?: { page?: number; limit?: number; isArchived?: boolean }) =>
    apiClient.get('/conversations', { params }),

  get: (id: string) =>
    apiClient.get(`/conversations/${id}`),

  create: (data: { title?: string; mode?: string }) =>
    apiClient.post('/conversations', data),

  update: (id: string, data: Partial<{
    title: string;
    isArchived: boolean;
    contextDocumentIds: string[];
    contextFolderId: string | null;
    contextTagIds: string[];
  }>) =>
    apiClient.patch(`/conversations/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/conversations/${id}`),
};

export const aiApi = {
  chat: (data: {
    question: string;
    conversationId?: string;
    mode?: 'general' | 'knowledge_base';
    temperature?: number;
  }) =>
    apiClient.post('/ai/chat', data),
};
```

### 4.3 useConversations Hook

```typescript
// apps/web/hooks/use-conversations.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api-client';

export function useConversations(params?: {
  page?: number;
  limit?: number;
  isArchived?: boolean;
}) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => conversationsApi.list(params),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title?: string; mode?: string }) =>
      conversationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      conversationsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
```

### 4.4 ConversationStore

```typescript
// apps/web/stores/conversation-store.ts

import { create } from 'zustand';

interface ConversationState {
  // 当前对话
  currentConversationId: string | null;
  currentMode: 'general' | 'knowledge_base';

  // UI 状态
  isLoading: boolean;

  // Actions
  setCurrentConversation: (id: string | null) => void;
  setMode: (mode: 'general' | 'knowledge_base') => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  currentConversationId: null,
  currentMode: 'general',
  isLoading: false,

  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setMode: (mode) => set({ currentMode: mode }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set({
    currentConversationId: null,
    currentMode: 'general',
    isLoading: false,
  }),
}));
```

### 4.5 共享类型扩展

```typescript
// packages/shared/src/types/api.ts 扩展

// ... 原有代码

// ============================================
// AI 对话 API 类型
// ============================================

export interface ChatRequest {
  question: string;
  conversationId?: string;
  mode?: 'general' | 'knowledge_base';
  temperature?: number;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ConversationListResponse {
  items: ConversationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConversationDetailResponse extends Conversation {
  messages: Message[];
  messageCount: number;
}
```

---

## 5. 文件产出清单

```
Phase 2-1b 总计：新增 12 文件，修改 2 文件

新增 (12 files):
├── apps/api/src/modules/ai/
│   ├── ai.controller.ts                # AI 对话 API
│   ├── ai.service.ts                   # AI 对话服务
│   ├── llm.service.ts                  # LLM API 封装
│   └── dto/
│       └── chat.dto.ts                 # 聊天 DTO
├── apps/api/src/modules/conversations/
│   ├── conversations.controller.ts     # 对话 CRUD API
│   └── dto/
│       ├── query-conversation.dto.ts   # 查询 DTO
│       └── update-conversation.dto.ts  # 更新 DTO
├── apps/web/hooks/
│   └── use-conversations.ts            # 对话数据 Hook
├── apps/web/stores/
│   └── conversation-store.ts           # 对话状态管理
└── packages/shared/src/types/
    └── api.ts (扩展)                   # API 类型定义

修改 (2 files):
├── apps/api/src/modules/ai/ai.module.ts
└── apps/web/lib/api-client.ts
```

---

## 6. 测试验证方案

### 6.1 单元测试

```typescript
// apps/api/src/modules/ai/llm.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
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

    service = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 需要 mock fetch 进行实际测试
});
```

```typescript
// apps/api/src/modules/ai/ai.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: LlmService,
          useValue: {
            chat: jest.fn().mockResolvedValue({
              content: 'Test response',
              tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
              model: 'deepseek-chat',
            }),
            generateTitle: jest.fn().mockResolvedValue('Test Title'),
          },
        },
        {
          provide: ConversationsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'conv-1', mode: 'general' }),
            findOne: jest.fn().mockResolvedValue({ id: 'conv-1', messages: [] }),
            incrementTokens: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            message: {
              create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should create new conversation and return response', async () => {
    const result = await service.chat({ question: 'Hello' });

    expect(result.conversationId).toBeDefined();
    expect(result.answer).toBe('Test response');
  });
});
```

### 6.2 集成测试

```typescript
// apps/api/test/ai.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AI API (e2e)', () => {
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

  describe('/api/ai/chat (POST)', () => {
    it('should create new conversation and return response', () => {
      return request(app.getHttpServer())
        .post('/ai/chat')
        .send({ question: '你好' })
        .expect(201)
        .expect((res) => {
          expect(res.body.conversationId).toBeDefined();
          expect(res.body.answer).toBeDefined();
        });
    });

    it('should continue existing conversation', async () => {
      // 先创建对话
      const createRes = await request(app.getHttpServer())
        .post('/ai/chat')
        .send({ question: '第一句话' });

      const conversationId = createRes.body.conversationId;

      // 继续对话
      return request(app.getHttpServer())
        .post('/ai/chat')
        .send({ question: '第二句话', conversationId })
        .expect(201)
        .expect((res) => {
          expect(res.body.conversationId).toBe(conversationId);
        });
    });
  });
});
```

### 6.3 手动验证清单

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| **创建对话** | POST `/api/conversations` | 返回新对话对象 |
| **对话列表** | GET `/api/conversations` | 返回分页列表 |
| **对话详情** | GET `/api/conversations/:id` | 返回对话含消息 |
| **AI 对话** | POST `/api/ai/chat` | 返回 AI 回复 |
| **多轮对话** | 连续 POST `/api/ai/chat` | 上下文保持 |
| **标题生成** | 创建新对话后 | 自动生成标题 |
| **Swagger 文档** | 访问 `/api/docs` | 显示所有 API |

### 6.4 验证脚本

```bash
#!/bin/bash
# scripts/verify-phase2-1b.sh

set -e

echo "=== Phase 2-1b 验证脚本 ==="

API_URL="http://localhost:4000/api"

# 1. 测试对话创建
echo "1. 测试对话创建..."
CONV_RESPONSE=$(curl -s -X POST "$API_URL/conversations" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试对话","mode":"general"}')
echo "创建对话: $CONV_RESPONSE"

# 2. 测试对话列表
echo "2. 测试对话列表..."
curl -s "$API_URL/conversations" | jq '.items[0]'

# 3. 测试 AI 对话（需要真实 API Key）
echo "3. 测试 AI 对话..."
CHAT_RESPONSE=$(curl -s -X POST "$API_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"question":"你好，请介绍一下自己"}')
echo "AI 回复: $CHAT_RESPONSE"

# 4. 测试多轮对话
CONV_ID=$(echo $CHAT_RESPONSE | jq -r '.conversationId')
echo "4. 测试多轮对话 (conversationId: $CONV_ID)..."
curl -s -X POST "$API_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"我刚才问了什么？\",\"conversationId\":\"$CONV_ID\"}" | jq '.answer'

# 5. 查看对话详情
echo "5. 查看对话详情..."
curl -s "$API_URL/conversations/$CONV_ID" | jq '.messages | length'

echo "=== 验证完成 ==="
```

---

## 7. 完成标准

- [ ] 对话 CRUD API 完整实现
- [ ] LLM 服务可调用阿里云百炼 API
- [ ] AI 对话接口返回正确响应
- [ ] 多轮对话上下文保持
- [ ] 自动生成对话标题
- [ ] Token 使用量统计
- [ ] 前端 Hook 和 Store 可用
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] Swagger 文档更新

---

## 8. 注意事项

1. **API Key 安全**：不要在日志中打印 API Key
2. **错误处理**：API 调用失败时返回友好错误信息
3. **Token 限制**：注意上下文长度限制，必要时截断历史消息
4. **并发控制**：同一对话同时只能有一个请求处理中
