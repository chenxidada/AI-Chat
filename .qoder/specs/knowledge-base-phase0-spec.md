# AI 知识库应用 - Phase 0 基础设施层 Spec（优化版）

## 1. 项目概述

### 1.1 目标
构建一个 AI 驱动的个人知识库应用的基础设施层，为后续功能开发奠定基础。

### 1.2 约束条件
| 约束 | 说明 |
|------|------|
| 无认证系统 | 个人单用户使用，无需登录 |
| 本地部署 | 数据存储在本地，计划部署到 NAS |
| 资源敏感 | 目标内存占用 < 1GB |
| AI 接口 | 支持 OpenAI API 兼容接口（Deepseek 等） |

### 1.3 技术栈（优化后）

| 层面 | 技术选择 | 说明 |
|------|---------|------|
| 包管理 | pnpm 9.x | Monorepo 支持 |
| 构建工具 | Turborepo | 增量构建 |
| 前端 | Next.js 14 (App Router) | React 18 + TypeScript |
| 后端 | NestJS 10 | TypeScript + 模块化 |
| 数据库 | PostgreSQL 16 + pgvector | 关系数据 + 向量搜索 |
| 搜索引擎 | Meilisearch 1.8 | 中文全文搜索 |
| 队列/缓存 | 内存方案 (p-queue + lru-cache) | **移除 Redis** |
| ORM | Prisma 5.x | 类型安全 |

### 1.4 资源占用预估

| 组件 | 空闲 | 正常使用 | 峰值 |
|------|------|---------|------|
| PostgreSQL | 100-150MB | 150-250MB | 300MB |
| Meilisearch | 80-120MB | 120-200MB | 300MB |
| NestJS | 80-100MB | 100-150MB | 200MB |
| Next.js | 80-100MB | 100-150MB | 200MB |
| **合计** | **340-470MB** | **470-750MB** | **1GB** |

---

## 2. 目录结构

```
/workspace/chendecheng/code/need/APP2/
├── apps/
│   ├── web/                          # Next.js 前端
│   │   ├── app/
│   │   │   ├── layout.tsx            # 根布局
│   │   │   ├── page.tsx              # 首页
│   │   │   ├── providers.tsx         # Provider 封装
│   │   │   └── globals.css           # 全局样式
│   │   ├── components/
│   │   │   └── ui/                   # shadcn/ui 组件目录
│   │   ├── hooks/
│   │   │   └── use-api.ts            # API Hook
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Axios 客户端
│   │   │   └── utils.ts              # 工具函数
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── components.json           # shadcn/ui 配置
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # NestJS 后端
│       ├── src/
│       │   ├── common/
│       │   │   ├── prisma/
│       │   │   │   ├── prisma.module.ts
│       │   │   │   └── prisma.service.ts
│       │   │   ├── filters/
│       │   │   │   └── http-exception.filter.ts
│       │   │   └── interceptors/
│       │   │       └── transform.interceptor.ts
│       │   ├── config/
│       │   │   └── configuration.ts
│       │   ├── modules/
│       │   │   └── health/
│       │   │       ├── health.module.ts
│       │   │       ├── health.controller.ts
│       │   │       └── health.service.ts
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── prisma/
│       │   └── schema.prisma
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── package.json
│
├── packages/
│   └── shared/                       # 共享代码包（合并 types + utils）
│       ├── src/
│       │   ├── types/
│       │   │   ├── entities.ts       # 实体类型
│       │   │   ├── api.ts            # API 类型
│       │   │   └── index.ts
│       │   ├── utils/
│       │   │   └── index.ts          # 工具函数
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docker/
│   └── postgres/
│       └── init.sql                  # pgvector 初始化
│
├── scripts/
│   └── verify.sh                     # 验证脚本
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .env.local                        # 本地环境变量（gitignore）
├── .gitignore
├── .prettierrc
└── .eslintrc.js
```

---

## 3. 实现任务清单

### Module 0.1: 根目录配置

| ID | 任务 | 产出文件 |
|----|------|---------|
| T0.1.1 | 创建根 package.json | `package.json` |
| T0.1.2 | 创建 pnpm workspace 配置 | `pnpm-workspace.yaml` |
| T0.1.3 | 创建 Turborepo 配置 | `turbo.json` |
| T0.1.4 | 创建环境变量模板 | `.env.example` |
| T0.1.5 | 创建 gitignore | `.gitignore` |
| T0.1.6 | 创建 Prettier 配置 | `.prettierrc` |
| T0.1.7 | 创建 ESLint 配置 | `.eslintrc.js` |

### Module 0.2: Docker 环境（无 Redis）

| ID | 任务 | 产出文件 |
|----|------|---------|
| T0.2.1 | 创建 Docker Compose（仅 PG + Meili） | `docker-compose.yml` |
| T0.2.2 | 创建 PostgreSQL 初始化脚本 | `docker/postgres/init.sql` |

### Module 0.3: 共享包

| ID | 任务 | 产出文件 |
|----|------|---------|
| T0.3.1 | 创建共享包配置 | `packages/shared/package.json` |
| T0.3.2 | 创建共享包 tsconfig | `packages/shared/tsconfig.json` |
| T0.3.3 | 创建实体类型定义 | `packages/shared/src/types/entities.ts` |
| T0.3.4 | 创建 API 类型定义 | `packages/shared/src/types/api.ts` |
| T0.3.5 | 创建工具函数 | `packages/shared/src/utils/index.ts` |
| T0.3.6 | 创建导出入口 | `packages/shared/src/index.ts` |

### Module 0.4: 后端项目

| ID | 任务 | 产出文件 |
|----|------|---------|
| T0.4.1 | 创建后端 package.json | `apps/api/package.json` |
| T0.4.2 | 创建后端 tsconfig | `apps/api/tsconfig.json`, `tsconfig.build.json` |
| T0.4.3 | 创建 NestJS CLI 配置 | `apps/api/nest-cli.json` |
| T0.4.4 | 创建 Prisma Schema（简化版） | `apps/api/prisma/schema.prisma` |
| T0.4.5 | 创建 Prisma 服务 | `apps/api/src/common/prisma/*` |
| T0.4.6 | 创建全局异常过滤器 | `apps/api/src/common/filters/*` |
| T0.4.7 | 创建响应转换拦截器 | `apps/api/src/common/interceptors/*` |
| T0.4.8 | 创建配置模块 | `apps/api/src/config/configuration.ts` |
| T0.4.9 | 创建健康检查模块 | `apps/api/src/modules/health/*` |
| T0.4.10 | 创建 App Module | `apps/api/src/app.module.ts` |
| T0.4.11 | 创建主入口 | `apps/api/src/main.ts` |

### Module 0.5: 前端项目

| ID | 任务 | 产出文件 |
|----|------|---------|
| T0.5.1 | 创建前端 package.json | `apps/web/package.json` |
| T0.5.2 | 创建前端 tsconfig | `apps/web/tsconfig.json` |
| T0.5.3 | 创建 Next.js 配置 | `apps/web/next.config.mjs` |
| T0.5.4 | 创建 Tailwind 配置 | `apps/web/tailwind.config.ts` |
| T0.5.5 | 创建 PostCSS 配置 | `apps/web/postcss.config.mjs` |
| T0.5.6 | 创建 shadcn/ui 配置 | `apps/web/components.json` |
| T0.5.7 | 创建全局样式 | `apps/web/app/globals.css` |
| T0.5.8 | 创建根布局 | `apps/web/app/layout.tsx` |
| T0.5.9 | 创建 Providers | `apps/web/app/providers.tsx` |
| T0.5.10 | 创建首页 | `apps/web/app/page.tsx` |
| T0.5.11 | 创建 API 客户端 | `apps/web/lib/api-client.ts` |
| T0.5.12 | 创建工具函数 | `apps/web/lib/utils.ts` |

### Module 0.6: 验证脚本

| ID | 任务 | 产出文件 |
|----|------|---------|
| T0.6.1 | 创建验证脚本 | `scripts/verify.sh` |

---

## 4. 核心配置文件内容

### 4.1 根目录 package.json

```json
{
  "name": "knowledge-base",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "dev:api": "turbo run dev --filter=@kb/api",
    "dev:web": "turbo run dev --filter=@kb/web",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:generate": "pnpm --filter @kb/api prisma generate",
    "db:migrate": "pnpm --filter @kb/api prisma migrate dev",
    "db:push": "pnpm --filter @kb/api prisma db push",
    "db:studio": "pnpm --filter @kb/api prisma studio",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "verify": "bash scripts/verify.sh"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "prettier": "^3.3.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.1.0"
}
```

### 4.2 pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 4.3 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", ".env.local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 4.4 docker-compose.yml（无 Redis）

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: kb-postgres
    environment:
      POSTGRES_USER: kb_user
      POSTGRES_PASSWORD: kb_password
      POSTGRES_DB: knowledge_base
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    deploy:
      resources:
        limits:
          memory: 512M
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U kb_user -d knowledge_base']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:v1.8
    container_name: kb-meilisearch
    environment:
      MEILI_MASTER_KEY: kb_meili_master_key_change_in_production
      MEILI_ENV: development
      MEILI_NO_ANALYTICS: 'true'
    ports:
      - '7700:7700'
    volumes:
      - meilisearch_data:/meili_data
    deploy:
      resources:
        limits:
          memory: 384M
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--spider', 'http://localhost:7700/health']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  meilisearch_data:
```

### 4.5 docker/postgres/init.sql

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 启用 uuid 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 验证扩展安装
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension not installed';
  END IF;
END
$$;

-- 打印确认信息
SELECT 'pgvector extension installed successfully' AS status;
```

### 4.6 .env.example

```bash
# ============================================
# 数据库配置
# ============================================
DATABASE_URL="postgresql://kb_user:kb_password@localhost:5432/knowledge_base?schema=public"

# ============================================
# Meilisearch 配置
# ============================================
MEILI_HOST=http://localhost:7700
MEILI_API_KEY=kb_meili_master_key_change_in_production

# ============================================
# AI 配置（OpenAI 兼容接口）
# ============================================
# Deepseek
AI_API_KEY=sk-your-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_CHAT_MODEL=deepseek-chat
AI_EMBEDDING_MODEL=text-embedding-3-small

# 可选：OpenAI（用于 Embedding）
# OPENAI_API_KEY=sk-xxx
# OPENAI_BASE_URL=https://api.openai.com/v1

# ============================================
# 应用配置
# ============================================
NODE_ENV=development
API_PORT=4000

# ============================================
# 前端配置
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 4.7 Prisma Schema（Phase 0 简化版）

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions", "fullTextSearch"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector", schema: "public"), uuidOssp(map: "uuid-ossp")]
}

// ============================================
// Phase 0 核心表
// ============================================

/// 文件夹 - 树状结构组织文档
model Folder {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name      String   @db.VarChar(255)
  parentId  String?  @map("parent_id") @db.Uuid
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 自引用关系
  parent    Folder?    @relation("FolderTree", fields: [parentId], references: [id], onDelete: Cascade)
  children  Folder[]   @relation("FolderTree")
  documents Document[]

  @@index([parentId])
  @@map("folders")
}

/// 文档 - 核心内容载体
model Document {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  folderId     String?  @map("folder_id") @db.Uuid
  title        String   @db.VarChar(500)
  content      String   @default("") // Markdown 内容
  contentPlain String   @default("") @map("content_plain") // 纯文本（用于搜索）
  sourceType   String   @default("manual") @map("source_type") @db.VarChar(50) // manual | import | clip
  sourceUrl    String?  @map("source_url")
  wordCount    Int      @default(0) @map("word_count")
  isArchived   Boolean  @default(false) @map("is_archived")
  metadata     Json     @default("{}")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // 关联
  folder Folder?       @relation(fields: [folderId], references: [id], onDelete: SetNull)
  tags   DocumentTag[]

  @@index([folderId])
  @@index([isArchived])
  @@index([createdAt(sort: Desc)])
  @@map("documents")
}

/// 标签 - 扁平化分类
model Tag {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name      String   @unique @db.VarChar(100)
  color     String   @default("#3b82f6") @db.VarChar(7) // HEX 颜色
  createdAt DateTime @default(now()) @map("created_at")

  documents DocumentTag[]

  @@map("tags")
}

/// 文档-标签关联表
model DocumentTag {
  documentId String @map("document_id") @db.Uuid
  tagId      String @map("tag_id") @db.Uuid

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([documentId, tagId])
  @@index([tagId])
  @@map("document_tags")
}

/// 对话 - AI 聊天会话
model Conversation {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  title      String   @default("新对话") @db.VarChar(255)
  mode       String   @default("general") @db.VarChar(20) // general | knowledge_base
  isArchived Boolean  @default(false) @map("is_archived")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  messages Message[]

  @@index([isArchived])
  @@index([updatedAt(sort: Desc)])
  @@map("conversations")
}

/// 消息 - 对话中的单条消息
model Message {
  id             String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  conversationId String   @map("conversation_id") @db.Uuid
  role           String   @db.VarChar(20) // user | assistant | system
  content        String
  citations      Json     @default("[]") // 引用的文档信息
  tokenUsage     Json?    @map("token_usage") // {prompt, completion}
  model          String?  @db.VarChar(100)
  createdAt      DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("messages")
}

/// 系统设置 - 单行配置表
model SystemSettings {
  id        String   @id @default("default")
  settings  Json     @default("{}") // {theme, language, aiConfig, ...}
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}

// ============================================
// Phase 1 扩展表（预留，暂不创建）
// ============================================
// - DocumentChunk (向量存储)
// - BiLink (双向链接)

// ============================================
// Phase 2 扩展表（预留，暂不创建）
// ============================================
// - DocumentVersion (版本历史)
// - DocumentSnapshot (快照)
// - PromptTemplate (提示词模板)
// - KnowledgeSet (知识集)
```

---

## 5. 关键代码文件

### 5.1 后端主入口 (apps/api/src/main.ts)

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 全局前缀
  app.setGlobalPrefix('api');

  // API 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 全局过滤器和拦截器
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Knowledge Base API')
      .setDescription('AI-powered personal knowledge base')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.API_PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 API running on: http://localhost:${port}/api`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
```

### 5.2 健康检查控制器 (apps/api/src/modules/health/health.controller.ts)

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '基础健康检查' })
  @ApiResponse({ status: 200, description: '服务正常' })
  check() {
    return this.healthService.check();
  }

  @Get('db')
  @ApiOperation({ summary: '数据库连接检查' })
  @ApiResponse({ status: 200, description: '数据库连接正常' })
  checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get('services')
  @ApiOperation({ summary: '所有服务状态检查' })
  @ApiResponse({ status: 200, description: '所有服务状态' })
  checkAllServices() {
    return this.healthService.checkAllServices();
  }
}
```

### 5.3 健康检查服务 (apps/api/src/modules/health/health.service.ts)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      
      // 检查 pgvector 扩展
      const extensions = await this.prisma.$queryRaw<{ extname: string }[]>`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;
      
      return {
        status: 'ok',
        database: 'connected',
        pgvector: extensions.length > 0 ? 'installed' : 'not installed',
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  }

  async checkAllServices() {
    const dbStatus = await this.checkDatabase();
    
    // Meilisearch 健康检查
    let meiliStatus = { status: 'unknown', message: '' };
    try {
      const meiliHost = this.config.get('MEILI_HOST', 'http://localhost:7700');
      const response = await fetch(`${meiliHost}/health`);
      if (response.ok) {
        meiliStatus = { status: 'ok', message: 'connected' };
      } else {
        meiliStatus = { status: 'error', message: `HTTP ${response.status}` };
      }
    } catch (error) {
      meiliStatus = { status: 'error', message: error.message };
    }

    return {
      status: dbStatus.status === 'ok' && meiliStatus.status === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'ok' },
        database: dbStatus,
        meilisearch: meiliStatus,
      },
    };
  }
}
```

### 5.4 前端首页 (apps/web/app/page.tsx)

```tsx
import { Suspense } from 'react';
import Link from 'next/link';

async function getApiStatus() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health/services`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('API not available');
    return await res.json();
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    ok: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.unknown}`}>
      {status}
    </span>
  );
}

async function ServiceStatus() {
  const data = await getApiStatus();
  
  if (data.status === 'error') {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <p className="text-red-600">⚠️ 无法连接到 API 服务</p>
        <p className="text-sm text-red-500 mt-1">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="font-medium">整体状态</span>
        <StatusBadge status={data.status} />
      </div>
      {data.services && Object.entries(data.services).map(([name, service]: [string, any]) => (
        <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="capitalize">{name}</span>
          <StatusBadge status={service.status} />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Logo & Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              📚 Knowledge Base
            </h1>
            <p className="text-lg text-gray-600">
              AI 驱动的个人知识库
            </p>
          </div>

          {/* Service Status */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">服务状态</h2>
            <Suspense fallback={<div className="animate-pulse h-32 bg-gray-100 rounded-lg" />}>
              <ServiceStatus />
            </Suspense>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/api/docs"
              target="_blank"
              className="p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-2">📖</div>
              <div className="font-medium">API 文档</div>
              <div className="text-sm text-gray-500">Swagger UI</div>
            </a>
            <a
              href="http://localhost:7700"
              target="_blank"
              className="p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-medium">Meilisearch</div>
              <div className="text-sm text-gray-500">搜索引擎控制台</div>
            </a>
          </div>

          {/* Version Info */}
          <div className="text-center mt-12 text-sm text-gray-400">
            Phase 0 - 基础设施层 | v0.1.0
          </div>
        </div>
      </div>
    </main>
  );
}
```

---

## 6. 验证方案与预期结果

### 6.1 验证脚本 (scripts/verify.sh)

```bash
#!/bin/bash
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "   Knowledge Base - Phase 0 验证脚本"
echo "============================================"
echo ""

# 计数器
PASSED=0
FAILED=0

check() {
  local name=$1
  local cmd=$2
  echo -n "检查 $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
    return 1
  fi
}

# ============================================
# 1. 环境检查
# ============================================
echo -e "\n${YELLOW}[1/5] 环境检查${NC}"

check "Node.js >= 20" "node -v | grep -E 'v2[0-9]|v[3-9][0-9]'"
check "pnpm >= 9" "pnpm -v | grep -E '^9'"
check "Docker 运行中" "docker info"

# ============================================
# 2. Docker 服务检查
# ============================================
echo -e "\n${YELLOW}[2/5] Docker 服务检查${NC}"

check "PostgreSQL 容器运行" "docker ps | grep kb-postgres"
check "Meilisearch 容器运行" "docker ps | grep kb-meilisearch"

# ============================================
# 3. 数据库检查
# ============================================
echo -e "\n${YELLOW}[3/5] 数据库检查${NC}"

check "PostgreSQL 连接" "docker exec kb-postgres pg_isready -U kb_user -d knowledge_base"
check "pgvector 扩展" "docker exec kb-postgres psql -U kb_user -d knowledge_base -c \"SELECT extname FROM pg_extension WHERE extname='vector'\" | grep vector"

# ============================================
# 4. 服务检查
# ============================================
echo -e "\n${YELLOW}[4/5] 服务检查${NC}"

check "Meilisearch 健康" "curl -sf http://localhost:7700/health | grep available"
check "API 健康检查" "curl -sf http://localhost:4000/api/health | grep ok"
check "API 数据库连接" "curl -sf http://localhost:4000/api/health/db | grep connected"

# ============================================
# 5. 前端检查
# ============================================
echo -e "\n${YELLOW}[5/5] 前端检查${NC}"

check "前端可访问" "curl -sf http://localhost:3000 | grep -i 'knowledge'"

# ============================================
# 结果汇总
# ============================================
echo ""
echo "============================================"
echo "   验证结果汇总"
echo "============================================"
echo -e "通过: ${GREEN}${PASSED}${NC}"
echo -e "失败: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 Phase 0 验证全部通过!${NC}"
  echo ""
  echo "访问地址:"
  echo "  - 前端: http://localhost:3000"
  echo "  - API:  http://localhost:4000/api"
  echo "  - Swagger: http://localhost:4000/api/docs"
  echo "  - Meilisearch: http://localhost:7700"
  exit 0
else
  echo -e "${RED}❌ 部分验证未通过，请检查上述失败项${NC}"
  exit 1
fi
```

### 6.2 验证步骤与预期结果

| 步骤 | 命令 | 预期结果 |
|------|------|---------|
| **1. 安装依赖** | `pnpm install` | 无错误输出，生成 node_modules |
| **2. 启动 Docker 服务** | `pnpm docker:up` | 两个容器启动，状态 healthy |
| **3. 生成 Prisma Client** | `pnpm db:generate` | 生成 @prisma/client |
| **4. 执行数据库迁移** | `pnpm db:migrate --name init` | 创建 6 张表 |
| **5. 启动后端** | `pnpm dev:api` | 监听 4000 端口 |
| **6. 启动前端** | `pnpm dev:web` | 监听 3000 端口 |
| **7. 运行验证脚本** | `pnpm verify` | 所有检查通过 |

### 6.3 手动验证清单

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| **API 健康检查** | `curl http://localhost:4000/api/health` | `{"status":"ok","timestamp":"...","uptime":...}` |
| **数据库连接** | `curl http://localhost:4000/api/health/db` | `{"status":"ok","database":"connected","pgvector":"installed"}` |
| **全服务状态** | `curl http://localhost:4000/api/health/services` | 所有服务 status: ok |
| **Swagger 文档** | 浏览器打开 `http://localhost:4000/api/docs` | 显示 Swagger UI |
| **前端首页** | 浏览器打开 `http://localhost:3000` | 显示 Knowledge Base 标题和服务状态 |
| **Prisma Studio** | `pnpm db:studio` | 打开数据库管理界面 |
| **查看数据库表** | Prisma Studio | 看到 6 张表：folders, documents, tags, document_tags, conversations, messages |

---

## 7. 完成标准

Phase 0 完成的定义：

### 必须达成 ✅
- [ ] 所有 Docker 服务正常运行（PostgreSQL + Meilisearch）
- [ ] 数据库迁移成功，创建 6 张核心表
- [ ] pgvector 扩展已安装并可用
- [ ] 后端 API 健康检查返回正常
- [ ] 前端首页可访问并显示服务状态
- [ ] `pnpm verify` 脚本全部通过

### 非必须（移至后续 Phase）
- 文档 CRUD API（Phase 1）
- Markdown 编辑器（Phase 1）
- 向量化功能（Phase 1）
- AI 对话功能（Phase 2）

---

## 8. 实现顺序

```
执行顺序：

1. 根目录配置 (T0.1.*)
   └── 创建 package.json, workspace, turbo 等配置

2. Docker 环境 (T0.2.*)
   └── 创建 docker-compose.yml 并启动服务

3. 共享包 (T0.3.*)
   └── 创建 packages/shared 类型和工具

4. 后端项目 (T0.4.*)
   ├── 创建项目结构和配置
   ├── 配置 Prisma 并迁移
   └── 实现健康检查模块

5. 前端项目 (T0.5.*)
   ├── 创建项目结构和配置
   └── 实现首页状态展示

6. 验证 (T0.6.*)
   └── 运行验证脚本确认完成
```

---

## 9. 关键文件清单（共 35 个文件）

```
根目录 (7)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
├── .gitignore
├── .prettierrc
└── .eslintrc.js

Docker (2)
├── docker-compose.yml
└── docker/postgres/init.sql

共享包 (5)
└── packages/shared/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── types/entities.ts
        └── types/api.ts

后端 (14)
└── apps/api/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── nest-cli.json
    ├── prisma/schema.prisma
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── config/configuration.ts
        ├── common/prisma/prisma.module.ts
        ├── common/prisma/prisma.service.ts
        ├── common/filters/http-exception.filter.ts
        ├── common/interceptors/transform.interceptor.ts
        ├── modules/health/health.module.ts
        ├── modules/health/health.controller.ts
        └── modules/health/health.service.ts

前端 (11)
└── apps/web/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── components.json
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── providers.tsx
        └── page.tsx
    └── lib/
        ├── api-client.ts
        └── utils.ts

脚本 (1)
└── scripts/verify.sh
```
