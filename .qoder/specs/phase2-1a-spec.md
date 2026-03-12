# Phase 2-1a Spec: 数据库扩展 + Embedding 服务

## 1. 目标

为 AI 对话功能搭建数据基础和向量化服务，包括：
- 创建 `document_chunks` 表存储文档分块的向量
- 实现阿里云百炼 qwen-embedding API 封装
- 创建对话管理的基础服务

## 2. 前置条件

- [x] Phase 1 完成
- [x] PostgreSQL pgvector 扩展已安装
- [x] 阿里云百炼 API Key 已获取

---

## 3. 数据库设计

### 3.1 新增 document_chunks 表

```sql
-- apps/api/prisma/migrations/xxx_add_document_chunks.sql

-- 文档分块表
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "heading" VARCHAR(500),
    "token_count" INTEGER DEFAULT 0,
    "embedding" vector(1024),  -- qwen-embedding 维度
    "content_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_chunks_document_id_fkey"
        FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_chunks_document_id_chunk_index_key"
        UNIQUE ("document_id", "chunk_index")
);

-- 向量索引 (IVFFlat)
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks"
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 普通索引
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");
CREATE INDEX "document_chunks_created_at_idx" ON "document_chunks"("created_at" DESC);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_chunks_updated_at
    BEFORE UPDATE ON "document_chunks"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 扩展现有表

```sql
-- 扩展 conversations 表
ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "context_document_ids" UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "context_folder_id" UUID,
ADD COLUMN IF NOT EXISTS "context_tag_ids" UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "model_used" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "total_tokens" INTEGER DEFAULT 0;

-- 添加索引
CREATE INDEX IF NOT EXISTS "conversations_context_folder_id_idx"
ON "conversations"("context_folder_id");
```

### 3.3 Prisma Schema 更新

```prisma
// apps/api/prisma/schema.prisma

// ============================================
// 文档分块 - 向量存储
// ============================================
model DocumentChunk {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  documentId  String   @map("document_id") @db.Uuid
  chunkIndex  Int      @map("chunk_index")
  chunkText   String   @map("chunk_text") @db.Text
  heading     String?  @db.VarChar(500)
  tokenCount  Int      @default(0) @map("token_count")
  embedding   Unsupported("vector(1024)")?
  contentHash String   @map("content_hash") @db.VarChar(64)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex])
  @@index([documentId])
  @@index([createdAt])
  @@map("document_chunks")
}

// ============================================
// 更新 Document 模型
// ============================================
model Document {
  // ... 原有字段
  chunks DocumentChunk[]
}

// ============================================
// 更新 Conversation 模型
// ============================================
model Conversation {
  id                String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  title             String   @default("新对话") @db.VarChar(255)
  mode              String   @default("general") @db.VarChar(20)
  isArchived        Boolean  @default(false) @map("is_archived")

  // 新增字段
  contextDocumentIds String[] @default([]) @map("context_document_ids") @db.Uuid
  contextFolderId    String?  @map("context_folder_id") @db.Uuid
  contextTagIds      String[] @default([]) @map("context_tag_ids") @db.Uuid
  modelUsed          String?  @map("model_used") @db.VarChar(100)
  totalTokens        Int      @default(0) @map("total_tokens")

  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  messages Message[]

  @@index([isArchived])
  @@index([updatedAt(sort: Desc)])
  @@index([contextFolderId])
  @@map("conversations")
}
```

---

## 4. 后端实现

### 4.1 目录结构

```
apps/api/src/modules/
├── ai/
│   ├── ai.module.ts
│   ├── embedding.service.ts      # Embedding 服务
│   └── dto/
│       └── sync-document.dto.ts
├── conversations/
│   ├── conversations.module.ts
│   ├── conversations.service.ts  # 对话基础服务
│   └── dto/
│       └── create-conversation.dto.ts
```

### 4.2 EmbeddingService 实现

```typescript
// apps/api/src/modules/ai/embedding.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  // 内存缓存
  private readonly cache = new Map<string, { embedding: number[]; expiry: number }>();
  private readonly cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 天

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('AI_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.apiKey = this.config.get<string>('AI_API_KEY') || '';
    this.model = this.config.get<string>('AI_EMBEDDING_MODEL') || 'text-embedding-v3';
  }

  /**
   * 获取文本的向量表示
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    const cacheKey = this.hashText(text);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return {
        embedding: cached.embedding,
        tokenCount: this.estimateTokens(text),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Embedding API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;
      const tokenCount = data.usage?.total_tokens || this.estimateTokens(text);

      // 缓存结果
      this.cache.set(cacheKey, {
        embedding,
        expiry: Date.now() + this.cacheTTL,
      });

      return { embedding, tokenCount };
    } catch (error) {
      this.logger.error(`Embedding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量获取向量
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // 阿里云百炼支持批量请求，但限制每批最多 25 条
    const batchSize = 25;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((text) => this.embedText(text)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 估算 token 数量（粗略估计：中文约 1.5 字/token，英文约 4 字符/token）
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 计算文本哈希用于缓存
   */
  private hashText(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 4.3 ConversationsService 实现

```typescript
// apps/api/src/modules/conversations/conversations.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

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
  async update(id: string, data: {
    title?: string;
    isArchived?: boolean;
    contextDocumentIds?: string[];
    contextFolderId?: string | null;
    contextTagIds?: string[];
  }) {
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
```

### 4.4 DTO 定义

```typescript
// apps/api/src/modules/conversations/dto/create-conversation.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsIn, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({ description: '对话标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: '对话模式',
    enum: ['general', 'knowledge_base'],
    default: 'general',
  })
  @IsOptional()
  @IsIn(['general', 'knowledge_base'])
  mode?: string;

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

### 4.5 模块注册

```typescript
// apps/api/src/modules/ai/ai.module.ts

import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class AiModule {}
```

```typescript
// apps/api/src/modules/conversations/conversations.module.ts

import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Module({
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
```

```typescript
// apps/api/src/app.module.ts 更新

import { AiModule } from './modules/ai/ai.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

@Module({
  imports: [
    // ... 原有模块
    AiModule,
    ConversationsModule,
  ],
})
export class AppModule {}
```

---

## 5. 共享类型定义

```typescript
// packages/shared/src/types/ai.ts

// ============================================
// Embedding 相关
// ============================================

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  heading: string | null;
  tokenCount: number;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingStatus {
  documentId: string;
  totalChunks: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// ============================================
// AI 配置
// ============================================

export interface AIProviderConfig {
  provider: 'bailian' | 'openai' | 'deepseek';
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
}

// 阿里云百炼默认配置
export const BAILIAN_DEFAULT_CONFIG: Partial<AIProviderConfig> = {
  provider: 'bailian',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  chatModel: 'deepseek-chat',
  embeddingModel: 'text-embedding-v3',
};
```

```typescript
// packages/shared/src/types/conversation.ts

// ============================================
// 对话扩展类型
// ============================================

export interface ConversationContext {
  documentIds?: string[];
  folderId?: string | null;
  tagIds?: string[];
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  messageCount: number;
}

export interface ConversationListItem extends Conversation {
  messageCount: number;
}
```

```typescript
// packages/shared/src/types/index.ts 更新

export * from './entities';
export * from './api';
export * from './ai';
export * from './conversation';
```

---

## 6. 文件产出清单

```
Phase 2-1a 总计：新增 8 文件，修改 2 文件

新增 (8 files):
├── apps/api/src/modules/ai/
│   ├── ai.module.ts                    # AI 模块定义
│   ├── embedding.service.ts            # Embedding 服务
│   └── dto/
│       └── sync-document.dto.ts        # 同步 DTO（预留）
├── apps/api/src/modules/conversations/
│   ├── conversations.module.ts         # 对话模块定义
│   ├── conversations.service.ts        # 对话基础服务
│   └── dto/
│       └── create-conversation.dto.ts  # 创建对话 DTO
└── packages/shared/src/types/
    └── ai.ts                           # AI 类型定义

修改 (2 files):
├── apps/api/prisma/schema.prisma       # 添加 DocumentChunk、扩展 Conversation
└── apps/api/src/app.module.ts          # 注册新模块

数据库迁移:
└── apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_document_chunks.sql
```

---

## 7. 测试验证方案

### 7.1 单元测试

```typescript
// apps/api/src/modules/ai/embedding.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                AI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                AI_API_KEY: 'test-api-key',
                AI_EMBEDDING_MODEL: 'text-embedding-v3',
              };
              return config[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should estimate tokens correctly', () => {
    const chineseText = '这是一段中文文本';
    const englishText = 'This is English text';

    // 测试私有方法需要通过 any 断言
    const chineseTokens = (service as any).estimateTokens(chineseText);
    const englishTokens = (service as any).estimateTokens(englishText);

    expect(chineseTokens).toBeGreaterThan(0);
    expect(englishTokens).toBeGreaterThan(0);
  });

  it('should cache embedding results', async () => {
    const text = 'test text for caching';

    // 第一次调用（实际请求，需要 mock）
    // 第二次调用应该命中缓存
  });
});
```

```typescript
// apps/api/src/modules/conversations/conversations.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: {
            conversation: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a conversation', async () => {
    const dto = { title: 'Test', mode: 'general' };
    const mockConversation = { id: 'uuid', ...dto };

    jest.spyOn(prisma.conversation, 'create').mockResolvedValue(mockConversation as any);

    const result = await service.create(dto);
    expect(result).toEqual(mockConversation);
  });

  it('should throw NotFoundException for non-existent conversation', async () => {
    jest.spyOn(prisma.conversation, 'findUnique').mockResolvedValue(null);

    await expect(service.findOne('non-existent-id')).rejects.toThrow('不存在');
  });
});
```

### 7.2 集成测试

```typescript
// apps/api/test/conversations.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Conversations API (e2e)', () => {
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

  describe('/api/conversations (POST)', () => {
    it('should create a new conversation', () => {
      return request(app.getHttpServer())
        .post('/conversations')
        .send({ title: 'Test Conversation', mode: 'general' })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.title).toBe('Test Conversation');
        });
    });
  });

  describe('/api/conversations (GET)', () => {
    it('should return paginated conversations', () => {
      return request(app.getHttpServer())
        .get('/conversations')
        .expect(200)
        .expect((res) => {
          expect(res.body.items).toBeDefined();
          expect(res.body.total).toBeDefined();
        });
    });
  });
});
```

### 7.3 手动验证清单

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| **数据库迁移** | `pnpm db:migrate` | 创建 document_chunks 表，扩展 conversations 表 |
| **Prisma Client** | `pnpm db:generate` | 生成新的类型定义 |
| **Embedding API** | 调用 `/api/embedding/test` | 返回 1024 维向量 |
| **对话创建** | POST `/api/conversations` | 返回新对话对象 |
| **对话列表** | GET `/api/conversations` | 返回分页列表 |
| **Swagger 文档** | 访问 `/api/docs` | 显示新增的 API |

### 7.4 验证脚本

```bash
#!/bin/bash
# scripts/verify-phase2-1a.sh

set -e

echo "=== Phase 2-1a 验证脚本 ==="

# 1. 检查数据库表
echo "1. 检查 document_chunks 表..."
docker exec kb-postgres psql -U kb_user -d knowledge_base -c "\d document_chunks"

# 2. 检查向量扩展
echo "2. 检查 pgvector 扩展..."
docker exec kb-postgres psql -U kb_user -d knowledge_base -c "SELECT extname FROM pg_extension WHERE extname = 'vector'"

# 3. 检查向量索引
echo "3. 检查向量索引..."
docker exec kb-postgres psql -U kb_user -d knowledge_base -c "\di document_chunks_embedding_idx"

# 4. 测试 Embedding API（需要真实 API Key）
echo "4. 测试 Embedding 服务..."
curl -s http://localhost:4000/api/health/ai | jq .

# 5. 测试对话 API
echo "5. 测试对话 API..."
curl -s -X POST http://localhost:4000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title":"测试对话","mode":"general"}' | jq .

echo "=== 验证完成 ==="
```

---

## 8. 完成标准

- [ ] `document_chunks` 表创建成功，包含向量索引
- [ ] `conversations` 表扩展字段添加成功
- [ ] Prisma Schema 更新并生成 Client
- [ ] `EmbeddingService` 可调用阿里云百炼 API
- [ ] `ConversationsService` CRUD 功能完整
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] Swagger 文档更新

---

## 9. 注意事项

1. **向量维度**：qwen-embedding 输出 1024 维向量，与 OpenAI 的 1536 维不同
2. **API 限流**：阿里云百炼有 QPS 限制，批量处理时需要控制并发
3. **缓存策略**：Embedding 结果缓存 7 天，避免重复调用
4. **错误处理**：API 调用失败时需要记录日志并抛出明确错误
