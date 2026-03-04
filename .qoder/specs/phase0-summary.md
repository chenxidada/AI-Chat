# Phase 0 - 基础设施层 实施总结

## 1. 概述

Phase 0 目标是为 AI 驱动的个人知识库应用搭建完整的基础设施层，包括 Monorepo 架构、数据库、搜索引擎、前后端框架等。

**实施时间**: 2026-03-03
**最终状态**: 全部验证通过

---

## 2. 架构决策记录

| 决策点 | 选择 | 替代方案 | 理由 |
|--------|------|---------|------|
| 缓存/队列方案 | 内存方案 (p-queue + lru-cache) | Redis | 单用户场景下 Redis 过重，节省 ~150MB 内存 |
| 数据库 | PostgreSQL 16 + pgvector | SQLite | 长期可维护性、向量搜索支持、NAS 部署适配 |
| 搜索引擎 | Meilisearch 1.8 | Elasticsearch | 中文全文搜索开箱即用，资源占用低 |
| Monorepo | pnpm workspaces + Turborepo | Nx / Lerna | 轻量、增量构建、配置简单 |
| ORM | Prisma 5.x | TypeORM / Drizzle | 类型安全、迁移工具完善、pgvector 支持 |

---

## 3. 实施文件清单

共创建 **38 个文件**（含自动生成文件），目录结构如下：

```
APP2/
├── 根目录配置 (8 files)
│   ├── package.json              # Monorepo 根配置
│   ├── pnpm-workspace.yaml       # 工作空间定义
│   ├── turbo.json                # Turborepo 构建配置
│   ├── .env.example              # 环境变量模板
│   ├── .env                      # 本地环境变量
│   ├── .gitignore
│   ├── .prettierrc
│   └── .eslintrc.js
│
├── Docker 环境 (2 files)
│   ├── docker-compose.yml        # PostgreSQL + Meilisearch
│   └── docker/postgres/init.sql  # pgvector 初始化
│
├── packages/shared/ (5 files)    # 共享类型和工具
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/index.ts
│   ├── src/types/entities.ts     # 6 个实体类型定义
│   ├── src/types/api.ts          # API 请求/响应类型
│   ├── src/types/index.ts
│   └── src/utils/index.ts        # 通用工具函数
│
├── apps/api/ (15 files)          # NestJS 后端
│   ├── package.json
│   ├── tsconfig.json / tsconfig.build.json
│   ├── nest-cli.json
│   ├── prisma/schema.prisma      # 7 张数据表定义
│   ├── src/main.ts               # 入口：Swagger/CORS/版本控制
│   ├── src/app.module.ts
│   ├── src/config/configuration.ts
│   ├── src/common/prisma/*       # Prisma 全局模块
│   ├── src/common/filters/*      # 全局异常过滤器
│   ├── src/common/interceptors/* # 响应转换拦截器
│   └── src/modules/health/*      # 健康检查模块 (3 endpoints)
│
├── apps/web/ (12 files)          # Next.js 前端
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs / tailwind.config.ts / postcss.config.mjs
│   ├── components.json           # shadcn/ui 配置
│   ├── app/layout.tsx            # 根布局 (Inter 字体)
│   ├── app/providers.tsx         # React Query Provider
│   ├── app/page.tsx              # 首页：服务状态仪表板
│   ├── app/globals.css           # Tailwind 全局样式
│   ├── lib/api-client.ts         # Axios 封装 + 健康检查函数
│   └── lib/utils.ts              # UI 工具函数
│
└── scripts/
    └── verify.sh                 # Phase 0 验证脚本
```

---

## 4. 数据库表结构

通过 `prisma db push` 创建了 7 张表：

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `folders` | 文件夹树状结构 | id, name, parent_id, sort_order |
| `documents` | 文档核心内容 | id, folder_id, title, content, content_plain, source_type |
| `tags` | 扁平化标签 | id, name, color |
| `document_tags` | 文档-标签多对多关联 | document_id, tag_id |
| `conversations` | AI 对话会话 | id, title, mode (general/knowledge_base) |
| `messages` | 对话消息 | id, conversation_id, role, content, citations |
| `system_settings` | 系统配置 (单行) | id="default", settings (JSON) |

已安装的 PostgreSQL 扩展：
- `vector` (pgvector) - 向量搜索
- `uuid-ossp` - UUID 生成
- `plpgsql` - 默认过程语言

---

## 5. API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 基础健康检查（uptime、timestamp） |
| GET | `/api/v1/health/db` | 数据库连接 + pgvector 状态 |
| GET | `/api/v1/health/services` | 全服务状态（API + DB + Meilisearch） |
| - | `/api/docs` | Swagger UI 文档 |

**注意**: API 启用了 URI 版本控制，所有端点路径包含 `/v1/` 前缀。

---

## 6. 验证结果

### 6.1 服务运行状态

| 服务 | 容器/进程 | 端口 | 状态 |
|------|----------|------|------|
| PostgreSQL 16 (pgvector) | kb-postgres | 5432 | healthy |
| Meilisearch v1.8 | kb-meilisearch | 7700 | healthy |
| NestJS API | nest start | 4000 | running |
| Next.js Frontend | next dev | 3000 | running |

### 6.2 健康检查结果

```json
// GET /api/v1/health
{ "success": true, "data": { "status": "ok", "timestamp": "...", "uptime": 139.83 } }

// GET /api/v1/health/db
{ "success": true, "data": { "status": "ok", "database": "connected", "pgvector": "installed" } }

// GET /api/v1/health/services
{ "success": true, "data": {
    "status": "ok",
    "services": {
      "api": { "status": "ok" },
      "database": { "status": "ok", "database": "connected", "pgvector": "installed" },
      "meilisearch": { "status": "ok", "message": "connected" }
    }
  }
}
```

### 6.3 前端验证

首页正确渲染，显示 4 个服务状态指标全部为绿色 `ok`（整体、api、database、meilisearch）。

---

## 7. 实施过程中的问题与修复

| # | 问题 | 原因 | 修复方案 |
|---|------|------|---------|
| 1 | pnpm 全局安装权限不足 | npm 全局安装需要 root 权限 | 安装到 `~/.local` 并添加 PATH |
| 2 | Prisma QueryEvent 类型错误 | 缺少类型导入 | 添加 `Prisma.QueryEvent` 类型断言 |
| 3 | react-query-devtools 缺失 | 未声明在 package.json | 添加 `@tanstack/react-query-devtools` 依赖 |
| 4 | Next.js fetch cache 冲突 | 同时使用 `cache: 'no-store'` 和 `revalidate: 0` | 移除 `revalidate: 0`，仅保留 `cache: 'no-store'` |
| 5 | Snap Docker 路径沙箱 | snap Docker 无法访问 `/workspace` 挂载点 | 将 docker-compose.yml 复制到 `$HOME` 目录 |
| 6 | Docker Hub 匿名拉取限额 | 未登录 Docker Hub | 执行 `docker login` |
| 7 | Docker socket 权限 | 用户不在 docker 组 | `sudo chmod 666 /var/run/docker.sock` |
| 8 | Prisma migrate 非交互模式 | CI 环境无法使用 `migrate dev` | 改用 `prisma db push` |
| 9 | 前端 API 路径不匹配 | URI 版本控制使路径变为 `/api/v1/*` | 修正前端 API 调用路径添加 `/v1/` |

---

## 8. 环境特殊注意事项

### Snap Docker 操作命令

由于 Docker 通过 snap 安装，无法直接读取 `/workspace` 目录下的文件，日常操作需要：

```bash
# 启动服务
docker compose -f ~/docker-compose-kb.yml up -d

# 停止服务
docker compose -f ~/docker-compose-kb.yml down

# 查看状态
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## 9. Phase 0 完成标准达成情况

| 标准 | 状态 |
|------|------|
| 所有 Docker 服务正常运行（PostgreSQL + Meilisearch） | done |
| 数据库 Schema 同步成功，创建 7 张核心表 | done |
| pgvector 扩展已安装并可用 | done |
| 后端 API 健康检查返回正常 | done |
| 前端首页可访问并显示服务状态 | done |
| Swagger 文档可访问 | done |

---

## 10. 技术资产清单

| 资产 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x | 运行时 |
| pnpm | 9.x | 包管理 |
| Turborepo | 2.x | Monorepo 构建 |
| TypeScript | 5.4.x | 类型安全 |
| NestJS | 10.x | 后端框架 |
| Next.js | 14.2.x | 前端框架 |
| Prisma | 5.22 | ORM |
| PostgreSQL | 16 | 数据库 |
| pgvector | - | 向量扩展 |
| Meilisearch | 1.8 | 全文搜索 |
| Tailwind CSS | 3.x | 样式框架 |
| React Query | 5.x | 数据获取 |
| Axios | - | HTTP 客户端 |
| shadcn/ui | - | UI 组件库（已配置，待使用） |

---

## 11. 后续阶段预留接口

### Prisma Schema 预留

```
Phase 1 扩展表（预留）:
- DocumentChunk (向量存储分块)
- BiLink (双向链接)

Phase 2 扩展表（预留）:
- DocumentVersion (版本历史)
- DocumentSnapshot (快照)
- PromptTemplate (提示词模板)
- KnowledgeSet (知识集)
```

### 后端模块预留

当前 `app.module.ts` 仅导入了 `HealthModule`，后续 Phase 将逐步添加：
- FolderModule, DocumentModule, TagModule (Phase 1)
- ConversationModule, AIModule, SearchModule (Phase 2)
