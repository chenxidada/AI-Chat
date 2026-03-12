# Phase 2 - AI 对话与引用 总体规划

## 1. 目标

在 Phase 1 核心内容管理基础上，实现 AI 驱动的智能对话功能，将静态知识库升级为**智能对话伙伴**。

### 1.1 核心价值

- 🤖 **基于知识的 AI 问答**：AI 能理解并回答基于个人知识库的问题
- 🔗 **可信的引用溯源**：每个回答都有明确的文档来源
- 💬 **自然的多轮对话**：结合上下文的深度交流
- 🎛️ **灵活的范围控制**：可限定对话的知识范围

### 1.2 成功标准

```
✅ 功能层面：
  1. 用户能用自然语言查询知识库
  2. AI 回答准确并显示引用来源
  3. 能保存和回顾对话历史
  4. 可切换通用模式和知识库模式

✅ 技术层面：
  1. RAG（检索增强生成）流程完整
  2. 向量检索性能满足要求（<1秒）
  3. 流式输出支持良好体验
  4. 错误处理和降级策略完备
```

---

## 2. 子阶段拆分

Phase 2 拆分为 **5 个递进子阶段**，每一步交付可用的增量价值：

```
Phase 2-1a ──► Phase 2-1b ──► Phase 2-2a ──► Phase 2-2b ──► Phase 2-3
 数据库扩展     基础对话      向量检索      引用系统      流式输出
 Embedding     (无RAG)       RAG引擎      前端界面      优化
```

| 子阶段 | 名称 | 核心交付 | Spec 文件 | 依赖 |
|--------|------|---------|-----------|------|
| **2-1a** | 数据库扩展 + Embedding | document_chunks 表 + 阿里云百炼 Embedding 服务 | `phase2-1a-spec.md` | Phase 1 |
| **2-1b** | 基础 AI 对话 | 对话 CRUD + 通用模式 AI 问答（无 RAG） | `phase2-1b-spec.md` | 2-1a |
| **2-2a** | 向量检索 + RAG | 文档分块 + 向量化 + RAG 引擎 | `phase2-2a-spec.md` | 2-1b |
| **2-2b** | 引用系统 + 前端 | 引用提取 + 对话界面 + 上下文选择器 | `phase2-2b-spec.md` | 2-2a |
| **2-3** | 流式输出 + 优化 | SSE 流式 + 性能优化 + 缓存策略 | `phase2-3-spec.md` | 2-2b |

---

## 3. 子阶段依赖关系

```
Phase 2-1a (数据库扩展 + Embedding 服务)
  │  提供：document_chunks 表、阿里云百炼 qwen-embedding API 封装
  │
  ▼
Phase 2-1b (基础 AI 对话)
  │  提供：对话 CRUD、通用模式 AI 问答（直接调用 LLM，无 RAG）
  │  验证：AI 服务可用、对话流程完整
  │
  ▼
Phase 2-2a (向量检索 + RAG 引擎)
  │  提供：文档分块流水线、向量化、相似度搜索、RAG 提示词工程
  │  验证：向量检索准确、RAG 回答有引用
  │
  ▼
Phase 2-2b (引用系统 + 前端界面)
  │  提供：引用提取、对话 UI、上下文选择器、知识库模式切换
  │  验证：前端可用、引用可点击跳转
  │
  ▼
Phase 2-3 (流式输出 + 优化)
         提供：SSE 流式输出、性能优化、缓存策略、监控指标
         验证：打字机效果、响应时间达标
```

---

## 4. 技术栈

| 组件 | 技术选择 | 说明 |
|------|---------|------|
| **LLM 服务** | 阿里云百炼 DeepSeek | 主对话模型 |
| **Embedding** | 阿里云百炼 qwen-embedding | 1024 维向量 |
| **向量存储** | PostgreSQL + pgvector | 复用现有数据库 |
| **向量索引** | IVFFlat | pgvector 索引 |
| **流式输出** | SSE (Server-Sent Events) | 前端 EventSource |
| **缓存** | 内存 LRU Cache | 复用 Phase 0 方案 |

### 4.1 阿里云百炼 API 配置

```bash
# .env 配置
AI_API_KEY=sk-xxx                    # 阿里云百炼 API Key
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_CHAT_MODEL=deepseek-chat          # 对话模型
AI_EMBEDDING_MODEL=text-embedding-v3 # qwen-embedding 模型名
```

### 4.2 Embedding 模型说明

| 模型 | 维度 | 说明 |
|------|------|------|
| text-embedding-v3 (qwen-embedding) | 1024 | 阿里云百炼，支持中文 |
| text-embedding-v2 | 1536 | 旧版本，不推荐 |

**注意**：向量维度为 1024，需要在 Prisma Schema 中正确配置。

---

## 5. 各子阶段工作量预估

| 子阶段 | 新增文件 | 后端 | 前端 | 共享包 |
|--------|---------|------|------|--------|
| 2-1a | ~8 | 6 files | 0 | 2 files |
| 2-1b | ~12 | 6 files | 4 files | 2 files |
| 2-2a | ~10 | 8 files | 0 | 2 files |
| 2-2b | ~18 | 4 files | 12 files | 2 files |
| 2-3 | ~6 | 3 files | 2 files | 1 file |
| **合计** | **~54** | **27** | **18** | **9** |

---

## 6. 新增依赖汇总

### 后端 (apps/api)

| 包名 | 版本 | 引入阶段 | 用途 |
|------|------|---------|------|
| 无新增依赖 | - | - | 使用原生 fetch 调用 API |

### 前端 (apps/web)

| 包名 | 版本 | 引入阶段 | 用途 |
|------|------|---------|------|
| react-markdown | 已安装 | 2-2b | AI 回答渲染（复用） |
| remark-gfm | 已安装 | 2-2b | GFM 语法（复用） |

### shadcn/ui 组件（2-2b 按需安装）

```
Tabs, Avatar, ScrollArea, Popover
```

---

## 7. Prisma Schema 变更

### 7.1 新增表

```prisma
/// 文档分块 - 向量存储
model DocumentChunk {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  documentId  String   @map("document_id") @db.Uuid
  chunkIndex  Int      @map("chunk_index")
  chunkText   String   @map("chunk_text") @db.Text
  heading     String?  @db.VarChar(500)
  tokenCount  Int      @default(0) @map("token_count")
  embedding   Unsupported("vector(1024)")?  // qwen-embedding 维度
  contentHash String   @map("content_hash") @db.VarChar(64)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex])
  @@index([documentId])
  @@index([createdAt])
  @@map("document_chunks")
}
```

### 7.2 现有表扩展

```prisma
// Conversation 扩展字段
model Conversation {
  // ... 原有字段
  contextDocumentIds String[] @default([]) @map("context_document_ids") @db.Uuid
  contextFolderId    String?  @map("context_folder_id") @db.Uuid
  contextTagIds      String[] @default([]) @map("context_tag_ids") @db.Uuid
  modelUsed          String?  @map("model_used") @db.VarChar(100)
  totalTokens        Int      @default(0) @map("total_tokens")
}

// Message 扩展字段（已有 citations, tokenUsage, model）
// 无需额外修改
```

---

## 8. API 路由规划

保持与现有项目一致的路由风格（无版本号）：

```
/api/conversations          # 对话 CRUD
/api/conversations/:id      # 对话详情
/api/conversations/:id/messages  # 对话消息

/api/ai/chat                # AI 对话（非流式）
/api/ai/chat/stream         # AI 对话（流式）

/api/embedding/sync/:documentId    # 单文档向量化
/api/embedding/sync-all            # 全量向量化
/api/embedding/status              # 向量化状态
```

---

## 9. Phase 2 整体完成标准

完成全部 5 个子阶段后：

- [ ] 对话 CRUD 完整（创建、列表、详情、删除、归档）
- [ ] 通用模式 AI 对话可用（无 RAG）
- [ ] 文档自动分块和向量化
- [ ] 向量检索准确（相似度 > 0.7）
- [ ] 知识库模式 RAG 问答可用
- [ ] 引用标记可点击跳转
- [ ] 上下文选择器可用（文件夹/标签/文档）
- [ ] 流式输出打字机效果
- [ ] 所有后端 API 通过 Swagger 文档可测试

### 非必须（移至 Phase 3）

- 文档版本历史
- 双向链接（BiLink）
- 知识图谱可视化
- 多模型切换

---

## 10. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **阿里云百炼 API 不稳定** | 对话功能不可用 | 低 | 1. 实现降级到搜索结果<br>2. 支持切换 OpenAI |
| **向量检索性能差** | 响应时间过长 | 中 | 1. 优化索引参数<br>2. 实现缓存<br>3. 限制检索数量 |
| **Token 成本失控** | 费用超预期 | 中 | 1. 用量监控和告警<br>2. 单次对话 Token 上限<br>3. 缓存热门问题 |
| **引用准确性低** | 用户体验差 | 中 | 1. 调整相似度阈值<br>2. 优化分块策略 |
| **大文档处理慢** | 系统卡顿 | 低 | 1. 异步处理<br>2. 进度提示 |

---

## 11. 文件产出清单总览

```
Phase 2 总计：新增 ~54 文件，修改 ~12 文件

=== Phase 2-1a (8 files) ===
新增:
├── apps/api/prisma/migrations/xxx_add_document_chunks.sql
├── apps/api/src/modules/ai/
│   ├── ai.module.ts
│   ├── embedding.service.ts
│   └── dto/
│       └── sync-document.dto.ts
├── apps/api/src/modules/conversations/
│   ├── conversations.module.ts
│   └── conversations.service.ts
└── packages/shared/src/types/
    └── ai.ts

修改:
├── apps/api/prisma/schema.prisma
└── apps/api/src/app.module.ts

=== Phase 2-1b (12 files) ===
新增:
├── apps/api/src/modules/ai/
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   ├── llm.service.ts
│   └── dto/
│       ├── chat.dto.ts
│       └── create-conversation.dto.ts
├── apps/api/src/modules/conversations/
│   ├── conversations.controller.ts
│   └── dto/
│       ├── query-conversation.dto.ts
│       └── update-conversation.dto.ts
├── apps/web/hooks/
│   └── use-conversations.ts
├── apps/web/stores/
│   └── conversation-store.ts
└── packages/shared/src/types/
    └── api.ts (扩展)

修改:
├── apps/api/src/modules/ai/ai.module.ts
└── packages/shared/src/types/index.ts

=== Phase 2-2a (10 files) ===
新增:
├── apps/api/src/modules/ai/
│   ├── chunking.service.ts
│   ├── rag.service.ts
│   ├── vector-search.service.ts
│   └── dto/
│       └── rag-query.dto.ts
├── apps/api/src/modules/embedding/
│   ├── embedding.module.ts
│   ├── embedding.controller.ts
│   └── dto/
│       └── sync-status.dto.ts
└── packages/shared/src/types/
    └── embedding.ts

修改:
├── apps/api/src/modules/ai/ai.module.ts
└── apps/api/src/modules/ai/ai.service.ts

=== Phase 2-2b (18 files) ===
新增:
├── apps/api/src/modules/ai/
│   └── citation.service.ts
├── apps/web/app/(main)/conversations/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── apps/web/components/ai/
│   ├── chat-interface.tsx
│   ├── chat-messages.tsx
│   ├── chat-input.tsx
│   ├── ai-message.tsx
│   ├── user-message.tsx
│   ├── citation-badge.tsx
│   ├── citation-popover.tsx
│   ├── context-selector.tsx
│   └── mode-toggle.tsx
├── apps/web/components/conversations/
│   ├── conversation-list.tsx
│   └── conversation-card.tsx
├── apps/web/hooks/
│   └── use-ai-chat.ts
└── packages/shared/src/types/
    └── conversation.ts

修改:
├── apps/web/app/(main)/layout.tsx
├── apps/web/components/layout/sidebar.tsx
└── packages/shared/src/types/index.ts

=== Phase 2-3 (6 files) ===
新增:
├── apps/api/src/modules/ai/
│   ├── streaming.service.ts
│   └── dto/
│       └── stream-event.dto.ts
├── apps/web/components/ai/
│   └── streaming-message.tsx
└── apps/web/hooks/
    └── use-streaming-chat.ts

修改:
├── apps/api/src/modules/ai/ai.controller.ts
├── apps/api/src/modules/ai/ai.service.ts
└── apps/web/components/ai/chat-interface.tsx
```
