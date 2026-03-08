# Phase 1 - 核心内容管理 总体规划

## 1. 目标

在 Phase 0 基础设施之上，实现文档内容的完整生命周期管理，包括创建、编辑、组织、搜索。

## 2. 子阶段拆分

Phase 1 拆分为 4 个递进子阶段，每一步交付可用的增量价值：

```
Phase 1-1a ──► Phase 1-1b ──► Phase 1-2 ──► Phase 1-3
 后端API层      前端管理UI    搜索与预览    Markdown编辑器
 + 布局Shell
```

| 子阶段 | 名称 | 核心交付 | Spec 文件 |
|--------|------|---------|-----------|
| **1-1a** | 后端 API + 前端布局 Shell | 3 组 CRUD API + 应用骨架 | `phase1-1a-spec.md` |
| **1-1b** | 前端 CRUD 管理界面 | 文件夹树 + 文档列表 + 标签管理 | `phase1-1b-spec.md` |
| **1-2** | 搜索与文档预览 | Meilisearch 集成 + 搜索 UI + 文档预览 | `phase1-2-spec.md` |
| **1-3** | Markdown 编辑器 | CodeMirror 分屏编辑 + 自动保存 | `phase1-3-spec.md` (索引), `phase1-3a-spec.md`, `phase1-3b-spec.md`, `phase1-3c-spec.md` |

## 3. 子阶段依赖关系

```
Phase 1-1a (后端 API + 布局 Shell)
  │  提供：文件夹/文档/标签 REST API，前端应用骨架
  │
  ▼
Phase 1-1b (前端管理 UI)
  │  提供：文件夹树、文档列表/卡片、标签管理界面
  │  文档编辑使用临时 textarea，非最终编辑器
  │
  ├──► Phase 1-2 (搜索与预览)
  │      提供：Meilisearch 全文搜索、Cmd+K 搜索框、文档预览渲染
  │
  └──► Phase 1-3 (Markdown 编辑器)
         提供：CodeMirror 编辑器替换 textarea、工具栏、自动保存
         注：1-2 和 1-3 互不依赖，可并行开发
```

## 4. 各子阶段工作量预估

| 子阶段 | 新增文件 | 后端 | 前端 | 共享包 |
|--------|---------|------|------|--------|
| 1-1a | ~20 | 16 files (3 模块 + 工具) | 3 files (布局 + store) | 1 file (类型更新) |
| 1-1b | ~15 | 0 | 14 files (组件 + hooks) | 0 |
| 1-2 | ~10 | 5 files (搜索模块) | 5 files (搜索 UI + 预览) | 0 |
| 1-3 | ~8 | 0 | 7 files (编辑器组件 + hooks) | 0 |
| **合计** | **~53** | **21** | **29** | **1** |

## 5. 新增依赖汇总

### 后端 (apps/api)

| 包名 | 版本 | 引入阶段 | 用途 |
|------|------|---------|------|
| meilisearch | ^0.41.0 | 1-2 | Meilisearch JS 客户端 |

### 前端 (apps/web)

| 包名 | 版本 | 引入阶段 | 用途 |
|------|------|---------|------|
| zustand | ^4.5.0 | 1-1a | 轻量状态管理 |
| @codemirror/view | ^6.0.0 | 1-3 | CodeMirror 编辑器核心 |
| @codemirror/state | ^6.0.0 | 1-3 | CodeMirror 状态管理 |
| @codemirror/lang-markdown | ^6.0.0 | 1-3 | Markdown 语言支持 |
| codemirror | ^6.0.0 | 1-3 | CodeMirror 基础包 |
| react-markdown | ^9.0.0 | 1-2 | Markdown 渲染（预览） |
| remark-gfm | ^4.0.0 | 1-2 | GFM 语法扩展 |
| rehype-highlight | ^7.0.0 | 1-2 | 代码块语法高亮 |
| react-syntax-highlighter | ^15.5.0 | 1-2 | 代码高亮组件 |

### shadcn/ui 组件（1-1a 按需安装）

Button, Input, Dialog, DropdownMenu, ContextMenu, Command, Badge, Separator, ScrollArea, Tooltip, Skeleton

## 6. Phase 1 整体完成标准

完成全部 4 个子阶段后：

- [ ] 文件夹 CRUD 完整（创建、重命名、移动、删除、排序）
- [ ] 文档 CRUD 完整（创建、Markdown 编辑、归档、永久删除、移动）
- [ ] 标签 CRUD 完整（创建、编辑、删除、关联文档）
- [ ] Meilisearch 全文搜索可用（中文分词、高亮）
- [ ] 前端布局 Shell 完成（侧边栏 + 内容区 + 搜索栏）
- [ ] Markdown 编辑器可用（分屏编辑 + 预览 + 自动保存）
- [ ] 文档列表分页、排序、过滤可用
- [ ] 所有后端 API 通过 Swagger 文档可测试

### 非必须（移至 Phase 2）

- AI 对话集成
- 文档向量化（DocumentChunk）
- 双向链接（BiLink）
- 文档版本历史
- 系统设置页面

## 7. Prisma Schema 变更

Phase 1 无需新增数据表，所有 CRUD 操作基于 Phase 0 已创建的 7 张表。

`DocumentChunk` 表（向量存储）推迟到 Phase 2（AI 集成）时添加。
