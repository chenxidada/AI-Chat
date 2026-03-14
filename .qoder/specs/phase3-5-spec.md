# Phase 3-5 Spec: AI 增强 + Markdown 增强 + 对话管理

## 1. 目标

实现 AI 对话增强、Markdown Mermaid 图表支持、流式响应、对话管理强化功能。完成后：

- Markdown 支持 Mermaid 图表渲染
- AI 消息实时渲染 Markdown 语法
- AI 对话支持 SSE 流式响应
- 对话置顶/星标功能
- 对话批量操作（归档/删除）
- 对话搜索功能
- AI 摘要与建议
- 对话内容压缩

---

## 2. 前置条件

- [x] Phase 1 完成（文档 CRUD）
- [x] Phase 2 完成（AI 对话）
- [x] Phase 3-1a 完成（批量操作）
- [x] Phase 3-2 完成（双向链接）
- [x] Phase 3-4 完成（导入导出）

---

## 3. 数据库变更

### 3.1 Conversation 表扩展

```prisma
// apps/api/prisma/schema.prisma

model Conversation {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  title      String   @default("新对话") @db.VarChar(255)
  mode       String   @default("general") @db.VarChar(20)
  isArchived Boolean  @default(false) @map("is_archived")

  // Phase 3-5: 新增字段
  isPinned   Boolean  @default(false) @map("is_pinned")      // 置顶
  isStarred  Boolean  @default(false) @map("is_starred")     // 星标
  summary    String?  @db.Text                                  // AI 摘要
  keywords   String[] @default([]) @map("keywords")           // 关键词

  // Phase 2: 上下文范围控制
  contextDocumentIds String[] @default([]) @map("context_document_ids")
  contextFolderId    String?  @map("context_folder_id") @db.Uuid
  contextTagIds      String[] @default([]) @map("context_tag_ids")
  modelUsed          String?  @map("model_used") @db.VarChar(100)
  totalTokens        Int      @default(0) @map("total_tokens")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  messages Message[]

  @@index([isArchived])
  @@index([isPinned])
  @@index([isStarred])
  @@index([updatedAt(sort: Desc)])
  @@index([contextFolderId])
  @@map("conversations")
}
```

### 3.2 数据库迁移命令

```bash
cd apps/api
npx prisma db push
```

---

## 4. 后端实现

### 4.1 目录结构

```
apps/api/src/modules/
├── ai/
│   ├── ai.controller.ts           # 新增流式端点
│   ├── ai.service.ts              # 新增摘要/建议方法
│   ├── streaming.service.ts       # 已存在，需扩展
│   └── dto/
│       ├── chat.dto.ts            # 已存在
│       └── summary.dto.ts         # 新增
├── conversations/
│   ├── conversations.service.ts   # 扩展置顶/星标/搜索
│   ├── conversations.controller.ts
│   └── dto/
│       ├── batch-operation.dto.ts # 新增
│       └── search.dto.ts          # 新增
└── summaries/
    ├── summaries.module.ts        # 新增模块
    ├── summaries.service.ts
    └── summaries.controller.ts
```

### 4.2 流式响应控制器

```typescript
// apps/api/src/modules/ai/ai.controller.ts

import {
  Controller,
  Post,
  Body,
  Sse,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AiService } from './ai.service';
import { StreamingService, StreamEvent } from './streaming.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('AI 对话')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly streamingService: StreamingService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: '发送消息并获取 AI 回复（非流式）' })
  @ApiResponse({ status: 201, description: 'AI 回复成功' })
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  @Sse('chat/stream')
  @ApiOperation({ summary: '发送消息并获取流式 AI 回复' })
  async chatStream(@Body() dto: ChatDto): Promise<Observable<MessageEvent>> {
    return this.aiService.chatStream(dto);
  }

  @Post('summarize/:conversationId')
  @ApiOperation({ summary: '生成对话摘要' })
  async summarizeConversation(@Param('conversationId') id: string) {
    return this.aiService.summarizeConversation(id);
  }

  @Post('suggest/:conversationId')
  @ApiOperation({ summary: '获取对话建议' })
  async getSuggestions(@Param('conversationId') id: string) {
    return this.aiService.getSuggestions(id);
  }
}
```

### 4.3 流式聊天服务

```typescript
// apps/api/src/modules/ai/ai.service.ts (扩展)

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
    const messages = this.buildMessages(history, dto.question, dto.mode || 'general');

    // 4. 如果是 RAG 模式，先获取上下文
    let contextData: { context?: string; citations?: any[] } = {};
    if (dto.mode === 'knowledge_base') {
      contextData = await this.rag.retrieveContext({
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

      // 在系统提示后添加上下文
      messages.splice(1, 0, {
        role: 'system',
        content: `参考资料：\n${contextData.context}`,
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
    return response.content.split(/[,，、]/).map((k) => k.trim()).slice(0, 5);
  }

  // ... 保留原有的 chat、buildHistory、buildMessages 方法
}
```

### 4.4 对话管理服务扩展

```typescript
// apps/api/src/modules/conversations/conversations.service.ts (扩展)

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

  // ... 保留原有方法 ...

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

  /**
   * 获取对话列表（支持置顶排序）
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
}
```

### 4.5 DTO 定义

```typescript
// apps/api/src/modules/conversations/dto/batch-operation.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsEnum, IsNotEmpty } from 'class-validator';

export class BatchOperationDto {
  @ApiProperty({ description: '对话 ID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({
    description: '操作类型',
    enum: ['archive', 'unarchive', 'delete', 'pin', 'unpin', 'star', 'unstar'],
  })
  @IsEnum(['archive', 'unarchive', 'delete', 'pin', 'unpin', 'star', 'unstar'])
  operation: 'archive' | 'unarchive' | 'delete' | 'pin' | 'unpin' | 'star' | 'unstar';
}
```

```typescript
// apps/api/src/modules/conversations/dto/search.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchConversationDto {
  @ApiProperty({ description: '搜索关键词', required: false })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ description: '对话模式', required: false })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiProperty({ description: '是否置顶', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPinned?: boolean;

  @ApiProperty({ description: '是否星标', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isStarred?: boolean;
}
```

### 4.6 对话控制器扩展

```typescript
// apps/api/src/modules/conversations/conversations.controller.ts (扩展)

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { BatchOperationDto } from './dto/batch-operation.dto';
import { SearchConversationDto } from './dto/search.dto';

@ApiTags('对话管理')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  // ... 保留原有方法 ...

  @Patch(':id/pin')
  @ApiOperation({ summary: '切换对话置顶状态' })
  togglePin(@Param('id') id: string) {
    return this.service.togglePin(id);
  }

  @Patch(':id/star')
  @ApiOperation({ summary: '切换对话星标状态' })
  toggleStar(@Param('id') id: string) {
    return this.service.toggleStar(id);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量操作对话' })
  batchOperation(@Body() dto: BatchOperationDto) {
    return this.service.batchOperation(dto);
  }

  @Get('search')
  @ApiOperation({ summary: '搜索对话' })
  search(@Query() dto: SearchConversationDto) {
    return this.service.search(dto);
  }
}
```

---

## 5. 前端实现

### 5.1 安装依赖

```bash
cd apps/web
pnpm add mermaid
pnpm add -D @types/mermaid
```

### 5.2 目录结构

```
apps/web/
├── components/
│   ├── ai/
│   │   ├── ai-message.tsx           # 修改：支持 Markdown 渲染
│   │   ├── streaming-message.tsx    # 新增：流式消息组件
│   │   ├── suggestion-list.tsx      # 新增：建议列表
│   │   └── summary-card.tsx         # 新增：摘要卡片
│   ├── conversations/
│   │   ├── conversation-list.tsx    # 修改：支持置顶/星标
│   │   ├── conversation-search.tsx  # 新增：搜索组件
│   │   ├── batch-actions.tsx        # 新增：批量操作栏
│   │   └── pin-star-buttons.tsx     # 新增：置顶/星标按钮
│   └── documents/
│       └── markdown-preview.tsx     # 修改：支持 Mermaid
├── hooks/
│   ├── use-streaming-chat.ts        # 新增：流式聊天 Hook
│   └── use-conversation-search.ts   # 新增：对话搜索 Hook
└── lib/
    └── mermaid.ts                   # 新增：Mermaid 配置
```

### 5.3 Mermaid 支持

```typescript
// apps/web/lib/mermaid.ts

import mermaid from 'mermaid';

// 初始化 Mermaid 配置
export const initMermaid = () => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
    sequence: {
      useMaxWidth: true,
    },
    gantt: {
      useMaxWidth: true,
    },
  });
};

// 渲染 Mermaid 图表
export const renderMermaid = async (code: string, id: string): Promise<string> => {
  try {
    const { svg } = await mermaid.render(`mermaid-${id}`, code);
    return svg;
  } catch (error) {
    console.error('Mermaid render error:', error);
    return `<pre class="text-red-500">Mermaid 语法错误:\n${code}</pre>`;
  }
};
```

### 5.4 Markdown 预览组件（支持 Mermaid）

```typescript
// apps/web/components/documents/markdown-preview.tsx

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <article className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-blue-600 prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeHighlight,
          rehypeKatex,
          [rehypeMermaid, { strategy: 'inline-svg' }],
        ]}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
```

### 5.5 AI 消息组件（支持 Markdown 渲染）

```typescript
// apps/web/components/ai/ai-message.tsx

'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { CitationBadge } from './citation-badge';
import { CitationPopover } from './citation-popover';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface Citation {
  id: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}

interface AIMessageProps {
  content: string;
  citations?: Citation[];
  isLoading?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

export function AIMessage({
  content,
  citations = [],
  isLoading,
  onCitationClick,
}: AIMessageProps) {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-gray-400">AI 正在思考...</span>
        </div>
      </div>
    );
  }

  // 处理引用标记，将其转换为特殊标记
  const processContent = (text: string) => {
    return text.replace(/\[(\d+)\]/g, '___CITATION_$1___');
  };

  // 自定义段落渲染器，处理引用标记
  const CustomParagraph = ({ children }: { children: React.ReactNode }) => {
    if (typeof children === 'string') {
      const parts = children.split(/___CITATION_(\d+)___/g);

      return (
        <>
          {parts.map((part, index) => {
            if (index % 2 === 1) {
              const citationNumber = parseInt(part);
              const citation = citations[citationNumber - 1];
              if (citation) {
                return (
                  <CitationBadge
                    key={index}
                    number={citationNumber}
                    onClick={(e) => {
                      setActiveCitation(citation);
                      setPopoverAnchor(e.currentTarget as HTMLElement);
                    }}
                  />
                );
              }
            }
            return part;
          })}
        </>
      );
    }
    return <>{children}</>;
  };

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeHighlight,
              rehypeKatex,
              [rehypeMermaid, { strategy: 'inline-svg' }],
            ]}
            components={{
              p: CustomParagraph,
            }}
          >
            {processContent(content)}
          </ReactMarkdown>

          {/* 引用来源列表 */}
          {citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 not-prose">
              <div className="text-xs text-gray-500 mb-2">引用来源：</div>
              <div className="flex flex-wrap gap-2">
                {citations.map((citation, index) => (
                  <CitationBadge
                    key={citation.id}
                    number={index + 1}
                    title={citation.documentTitle}
                    onClick={() => onCitationClick?.(citation)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 引用预览弹窗 */}
      {activeCitation && popoverAnchor && (
        <CitationPopover
          citation={activeCitation}
          anchor={popoverAnchor}
          onClose={() => {
            setActiveCitation(null);
            setPopoverAnchor(null);
          }}
          onOpenDocument={() => {
            onCitationClick?.(activeCitation);
            setActiveCitation(null);
            setPopoverAnchor(null);
          }}
        />
      )}
    </div>
  );
}
```

### 5.6 流式消息组件

```typescript
// apps/web/components/ai/streaming-message.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { CitationBadge } from './citation-badge';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  citations?: any[];
  onCitationClick?: (citation: any) => void;
}

export function StreamingMessage({
  content,
  isStreaming,
  citations = [],
  onCitationClick,
}: StreamingMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content, isStreaming]);

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* 消息内容 */}
      <div ref={contentRef} className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeHighlight,
              rehypeKatex,
              [rehypeMermaid, { strategy: 'inline-svg' }],
            ]}
          >
            {content || '...'}
          </ReactMarkdown>

          {/* 流式指示器 */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
          )}
        </div>

        {/* 引用来源列表（流式结束后显示） */}
        {!isStreaming && citations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200 not-prose">
            <div className="text-xs text-gray-500 mb-2">引用来源：</div>
            <div className="flex flex-wrap gap-2">
              {citations.map((citation, index) => (
                <CitationBadge
                  key={citation.id}
                  number={index + 1}
                  title={citation.documentTitle}
                  onClick={() => onCitationClick?.(citation)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.7 流式聊天 Hook

```typescript
// apps/web/hooks/use-streaming-chat.ts

import { useState, useCallback, useRef } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';

interface UseStreamingChatOptions {
  onMessage?: (content: string) => void;
  onComplete?: (data: { conversationId: string; citations: any[] }) => void;
  onError?: (error: Error) => void;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);

  const startStream = useCallback(
    async (question: string, conversationId?: string, mode: string = 'general') => {
      setIsStreaming(true);
      setStreamedContent('');

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/ai/chat/stream`;

      // 使用 POST 请求启动 SSE
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          conversationId,
          mode,
        }),
      });

      if (!response.ok) {
        options.onError?.(new Error('Failed to start stream'));
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        options.onError?.(new Error('No reader available'));
        setIsStreaming(false);
        return;
      }

      let buffer = '';
      let conversationIdResult = conversationId;
      let citations: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    conversationIdResult = data.conversationId;
                    break;

                  case 'chunk':
                    setStreamedContent((prev) => prev + data.content);
                    options.onMessage?.(data.content);
                    break;

                  case 'done':
                    citations = data.citations || [];
                    break;

                  case 'error':
                    options.onError?.(new Error(data.message));
                    break;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (error) {
        options.onError?.(error as Error);
      } finally {
        setIsStreaming(false);
        options.onComplete?.({
          conversationId: conversationIdResult || '',
          citations,
        });
      }
    },
    [options],
  );

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    isStreaming,
    streamedContent,
    startStream,
    stopStream,
  };
}
```

### 5.8 对话列表组件（支持置顶/星标）

```typescript
// apps/web/components/conversations/conversation-list.tsx

'use client';

import { useState } from 'react';
import { Pin, Star, MoreVertical, Archive, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Conversation {
  id: string;
  title: string;
  summary?: string;
  isPinned: boolean;
  isStarred: boolean;
  updatedAt: string;
  messageCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onTogglePin,
  onToggleStar,
  onArchive,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="space-y-1">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={cn(
            'group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors',
            selectedId === conv.id
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-gray-100',
          )}
          onClick={() => onSelect(conv.id)}
        >
          {/* 置顶/星标图标 */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {conv.isPinned && (
              <Pin className="h-3 w-3 text-blue-500" />
            )}
            {conv.isStarred && (
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            )}
          </div>

          {/* 对话信息 */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{conv.title}</div>
            {conv.summary && (
              <div className="text-xs text-gray-500 truncate">{conv.summary}</div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {formatDistanceToNow(new Date(conv.updatedAt), {
                addSuffix: true,
                locale: zhCN,
              })}
              {' · '}
              {conv.messageCount} 条消息
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTogglePin(conv.id)}>
                  <Pin className="h-4 w-4 mr-2" />
                  {conv.isPinned ? '取消置顶' : '置顶'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleStar(conv.id)}>
                  <Star className="h-4 w-4 mr-2" />
                  {conv.isStarred ? '取消星标' : '星标'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(conv.id)}>
                  <Archive className="h-4 w-4 mr-2" />
                  归档
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => onDelete(conv.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.9 对话搜索组件

```typescript
// apps/web/components/conversations/conversation-search.tsx

'use client';

import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';

interface ConversationSearchProps {
  onSearch: (query: string, filters: { mode?: string; isPinned?: boolean; isStarred?: boolean }) => void;
}

export function ConversationSearch({ onSearch }: ConversationSearchProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<string>('all');
  const [filter, setFilter] = useState<string>('all');

  const debouncedSearch = useDebounce((value: string) => {
    const filters: any = {};
    if (mode !== 'all') filters.mode = mode;
    if (filter === 'pinned') filters.isPinned = true;
    if (filter === 'starred') filters.isStarred = true;

    onSearch(value, filters);
  }, 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('', {});
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="搜索对话标题或内容..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Select value={mode} onValueChange={(v) => {
        setMode(v);
        const filters: any = {};
        if (v !== 'all') filters.mode = v;
        if (filter === 'pinned') filters.isPinned = true;
        if (filter === 'starred') filters.isStarred = true;
        onSearch(query, filters);
      }}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="模式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部模式</SelectItem>
          <SelectItem value="general">通用</SelectItem>
          <SelectItem value="knowledge_base">知识库</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filter} onValueChange={(v) => {
        setFilter(v);
        const filters: any = {};
        if (mode !== 'all') filters.mode = mode;
        if (v === 'pinned') filters.isPinned = true;
        if (v === 'starred') filters.isStarred = true;
        onSearch(query, filters);
      }}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="筛选" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="pinned">已置顶</SelectItem>
          <SelectItem value="starred">已星标</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

### 5.10 批量操作组件

```typescript
// apps/web/components/conversations/batch-actions.tsx

'use client';

import { useState } from 'react';
import { Pin, Star, Archive, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BatchActionsProps {
  selectedIds: string[];
  onClear: () => void;
  onBatchOperation: (operation: string) => void;
}

export function BatchActions({ selectedIds, onClear, onBatchOperation }: BatchActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-lg shadow-lg p-3 flex items-center gap-3">
        <span className="text-sm">
          已选择 {selectedIds.length} 个对话
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-800"
            onClick={() => onBatchOperation('pin')}
          >
            <Pin className="h-4 w-4 mr-1" />
            置顶
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-800"
            onClick={() => onBatchOperation('star')}
          >
            <Star className="h-4 w-4 mr-1" />
            星标
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-800"
            onClick={() => onBatchOperation('archive')}
          >
            <Archive className="h-4 w-4 mr-1" />
            归档
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-gray-800 hover:text-red-400"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            删除
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800"
          onClick={onClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.length} 个对话吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                onBatchOperation('delete');
                setShowDeleteDialog(false);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### 5.11 建议列表组件

```typescript
// apps/web/components/ai/suggestion-list.tsx

'use client';

import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuggestionListProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading?: boolean;
}

export function SuggestionList({ suggestions, onSelect, isLoading }: SuggestionListProps) {
  if (suggestions.length === 0 && !isLoading) return null;

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Lightbulb className="h-4 w-4" />
        <span>您可能想问：</span>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <>
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          </>
        ) : (
          suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start text-left h-auto py-2 px-3"
              onClick={() => onSelect(suggestion)}
            >
              {suggestion}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
```

### 5.12 摘要卡片组件

```typescript
// apps/web/components/ai/summary-card.tsx

'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SummaryCardProps {
  summary: string;
  keywords: string[];
  onGenerateSummary?: () => void;
  isGenerating?: boolean;
}

export function SummaryCard({
  summary,
  keywords,
  onGenerateSummary,
  isGenerating,
}: SummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">对话摘要</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {summary ? (
            <>
              <p className="text-sm text-gray-600">{summary}</p>

              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-2">暂无摘要</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateSummary?.();
                }}
                disabled={isGenerating}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {isGenerating ? '生成中...' : '生成摘要'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 6. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/chat` | 非流式聊天 |
| SSE | `/api/ai/chat/stream` | 流式聊天 |
| POST | `/api/ai/summarize/:id` | 生成对话摘要 |
| POST | `/api/ai/suggest/:id` | 获取对话建议 |
| GET | `/api/conversations` | 获取对话列表（支持置顶/星标排序） |
| GET | `/api/conversations/search` | 搜索对话 |
| PATCH | `/api/conversations/:id/pin` | 切换置顶状态 |
| PATCH | `/api/conversations/:id/star` | 切换星标状态 |
| POST | `/api/conversations/batch` | 批量操作对话 |

---

## 7. 文件产出清单

```
Phase 3-5 总计：新增 16 文件，修改 6 文件

后端新增 (5 files):
├── src/modules/conversations/dto/
│   ├── batch-operation.dto.ts
│   └── search.dto.ts
└── src/modules/summaries/
    ├── summaries.module.ts
    ├── summaries.service.ts
    └── summaries.controller.ts

后端修改 (4 files):
├── prisma/schema.prisma
├── src/modules/ai/ai.controller.ts
├── src/modules/ai/ai.service.ts
├── src/modules/conversations/conversations.service.ts
├── src/modules/conversations/conversations.controller.ts
└── src/app.module.ts

前端新增 (11 files):
├── components/ai/
│   ├── streaming-message.tsx
│   ├── suggestion-list.tsx
│   └── summary-card.tsx
├── components/conversations/
│   ├── conversation-search.tsx
│   ├── batch-actions.tsx
│   └── pin-star-buttons.tsx
├── hooks/
│   ├── use-streaming-chat.ts
│   └── use-conversation-search.ts
└── lib/
    └── mermaid.ts

前端修改 (2 files):
├── components/ai/ai-message.tsx
├── components/documents/markdown-preview.tsx
└── components/conversations/conversation-list.tsx
```

---

## 8. 新增依赖

### 后端

```bash
# 无需新增依赖，使用现有的
```

### 前端

```bash
cd apps/web
pnpm add mermaid rehype-mermaid
pnpm add -D @types/mermaid
```

---

## 9. 验证方案

### 9.1 后端验证

```bash
# 1. 数据库迁移
cd apps/api
npx prisma db push

# 2. 测试置顶功能
curl -X PATCH http://localhost:4000/api/conversations/{id}/pin

# 3. 测试星标功能
curl -X PATCH http://localhost:4000/api/conversations/{id}/star

# 4. 测试搜索功能
curl "http://localhost:4000/api/conversations/search?query=test"

# 5. 测试批量操作
curl -X POST http://localhost:4000/api/conversations/batch \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2"], "operation": "archive"}'

# 6. 测试摘要生成
curl -X POST http://localhost:4000/api/ai/summarize/{conversationId}

# 7. 测试建议生成
curl -X POST http://localhost:4000/api/ai/suggest/{conversationId}
```

### 9.2 前端验证

```bash
# 安装依赖
cd apps/web
pnpm add mermaid rehype-mermaid

# 启动前端
npx next dev

# 测试项目
# 1. Mermaid 图表渲染
# 2. AI 消息 Markdown 渲染
# 3. 流式响应
# 4. 对话置顶/星标
# 5. 对话搜索
# 6. 批量操作
# 7. AI 摘要生成
# 8. AI 建议列表
```

---

## 10. 完成标准

- [ ] Prisma Schema 更新（isPinned, isStarred, summary, keywords）
- [ ] 流式响应 API 可用
- [ ] 对话摘要 API 可用
- [ ] 对话建议 API 可用
- [ ] 对话置顶/星标 API 可用
- [ ] 对话批量操作 API 可用
- [ ] 对话搜索 API 可用
- [ ] Mermaid 图表渲染可用
- [ ] AI 消息 Markdown 渲染可用
- [ ] 流式消息组件可用
- [ ] 对话列表组件支持置顶/星标
- [ ] 对话搜索组件可用
- [ ] 批量操作组件可用
- [ ] 建议列表组件可用
- [ ] 摘要卡片组件可用
- [ ] Swagger 文档更新

---

## 11. 技术要点说明

### 11.1 Mermaid 集成

- 使用 `rehype-mermaid` 插件实现服务端渲染
- 支持 flowchart、sequence、gantt、pie 等图表类型
- 自动处理语法错误，显示错误提示

### 11.2 流式响应

- 使用 Server-Sent Events (SSE) 实现
- 后端使用 NestJS `@Sse()` 装饰器
- 前端使用 `fetch` + `ReadableStream` 读取
- 支持中断和重连

### 11.3 对话管理

- 置顶对话优先显示在列表顶部
- 星标对话作为重要标记
- 批量操作支持事务
- 搜索支持标题、摘要、消息内容

### 11.4 AI 摘要与建议

- 摘要限制在 100-200 字
- 关键词提取 5 个
- 建议列表 3 条
- 使用低温度（temperature=0.3）保证稳定性
