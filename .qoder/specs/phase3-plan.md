# Phase 3 - 批量操作与高级功能 总体规划

## 1. 目标

在 Phase 1 核心内容管理和 Phase 2 AI 对话基础上，实现批量操作效率提升、双向链接知识网络、知识图谱可视化、文件导入等高级功能，将知识库升级为**高效的知识管理平台**。

### 1.1 核心价值

- 🚀 **批量操作效率**：多选、批量处理、模板快速创建
- 🔗 **知识网络构建**：双向链接建立文档关联
- 📊 **可视化图谱**：直观展示知识关系网络
- 📥 **便捷导入**：多格式文件批量导入
- 💾 **数据安全**：完整的数据备份与恢复

### 1.2 成功标准

```
✅ 功能层面：
  1. 用户能批量操作文档和文件夹
  2. 模板系统可用，快速创建标准化文档
  3. 双向链接自动建立和展示
  4. 知识图谱可视化并支持导出
  5. 多格式文件批量导入
  6. 数据可完整备份和恢复

✅ 技术层面：
  1. 批量操作事务一致性
  2. 链接解析准确高效
  3. 图谱渲染流畅（>100节点）
  4. 文件解析稳定可靠
```

---

## 2. 子阶段拆分

Phase 3 拆分为 **5 个递进子阶段**，每一步交付可用的增量价值：

```
Phase 3-1a ──► Phase 3-1b ──► Phase 3-2 ──► Phase 3-3 ──► Phase 3-4
 批量操作        模板系统      双向链接     知识图谱     文件导入
 + 收藏置顶                    + 目录大纲    + 导出图片   + 数据备份
                               + 搜索增强
```

| 子阶段 | 名称 | 核心交付 | Spec 文件 | 依赖 |
|--------|------|---------|-----------|------|
| **3-1a** | 批量操作 + 收藏置顶 | 多选 UI + 批量 API + 收藏功能 | `phase3-1a-spec.md` | Phase 1 |
| **3-1b** | 模板系统 | 模板 CRUD + 使用模板创建 + 文档复制 | `phase3-1b-spec.md` | 3-1a |
| **3-2** | 双向链接 + 增强 | 链接解析 + 反向链接 + 目录大纲 + 搜索高亮 | `phase3-2-spec.md` | Phase 1 |
| **3-3** | 知识图谱 | React Flow 图谱 + 导出图片 + 最近文档 | `phase3-3-spec.md` | 3-2 |
| **3-4** | 文件导入 + 优化 | 批量导入 + 导出功能 + 数据备份 + 快捷键 | `phase3-4-spec.md` | Phase 1 |

---

## 3. 子阶段依赖关系

```
Phase 3-1a (批量操作 + 收藏置顶)
  │  提供：多选 UI、批量 API、收藏/置顶功能
  │
  ▼
Phase 3-1b (模板系统)
  │  提供：模板 CRUD、使用模板创建文档、文档复制
  │  验证：模板创建流程完整
  │
  ├──► Phase 3-2 (双向链接 + 增强)
  │      提供：链接解析、反向链接、目录大纲、搜索高亮、高级筛选
  │      验证：链接关系正确、大纲提取准确
  │
  └──► Phase 3-4 (文件导入 + 优化) [可并行]
         提供：批量导入、导出功能、数据备份、快捷键
         验证：导入解析正确、备份恢复完整

Phase 3-2 ──► Phase 3-3 (知识图谱)
                提供：React Flow 图谱、导出图片、最近文档
                验证：图谱渲染流畅、导出功能可用
```

---

## 4. 各子阶段功能详情

### 4.1 Phase 3-1a: 批量操作 + 收藏置顶

#### 批量操作功能

| 功能 | 说明 |
|------|------|
| 列表多选 | Checkbox 多选 + 全选 + Shift 范围选 |
| 批量移动 | 将多个文档移动到指定文件夹 |
| 批量添加标签 | 为多个文档添加/移除标签 |
| 批量归档 | 将多个文档标记为归档状态 |
| 批量删除 | 将多个文档移入回收站 |
| 批量操作栏 | 底部浮动操作栏，显示已选数量 |

#### 收藏与置顶功能

| 功能 | 说明 |
|------|------|
| 文档收藏 | 收藏按钮 + 收藏列表入口 |
| 文档置顶 | 置顶文档在列表顶部显示 |
| 文件夹置顶 | 置顶文件夹在树顶部显示 |
| 收藏夹侧边栏 | 快速访问收藏的文档 |

#### API 设计

```
POST /api/documents/batch-move      { documentIds: string[], folderId: string }
POST /api/documents/batch-tag       { documentIds: string[], tagIds: string[], mode: "add" | "remove" | "replace" }
POST /api/documents/batch-archive   { documentIds: string[] }
POST /api/documents/batch-delete    { documentIds: string[] }
POST /api/documents/batch-restore   { documentIds: string[] }

PATCH /api/documents/:id/favorite   { isFavorite: boolean }
PATCH /api/documents/:id/pin        { isPinned: boolean }
PATCH /api/folders/:id/pin          { isPinned: boolean }

GET  /api/documents/favorites       获取收藏的文档列表
```

---

### 4.2 Phase 3-1b: 模板系统

#### 模板功能

| 功能 | 说明 |
|------|------|
| 模板创建 | 从现有文档创建模板 / 新建空白模板 |
| 模板分类 | 模板分类管理（笔记、会议、报告等） |
| 模板预览 | 模板内容预览 |
| 使用模板创建 | 选择模板创建新文档 |
| 文档复制 | 复制现有文档为新文档 |

#### 数据库设计

```prisma
/// 文档模板
model DocumentTemplate {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String   @db.VarChar(255)
  description String?  @db.Text
  category    String   @default("general") @db.VarChar(50)
  content     String   @default("") @db.Text
  thumbnail   String?  @db.VarChar(500)  // 预览图 URL
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([category])
  @@map("document_templates")
}
```

#### API 设计

```
GET    /api/templates              获取模板列表（支持分类筛选）
POST   /api/templates              创建模板
GET    /api/templates/:id          获取模板详情
PUT    /api/templates/:id          更新模板
DELETE /api/templates/:id          删除模板

POST   /api/documents/from-template/:templateId   使用模板创建文档
POST   /api/documents/:id/duplicate               复制文档
```

---

### 4.3 Phase 3-2: 双向链接 + 增强

#### 双向链接功能

| 功能 | 说明 |
|------|------|
| 链接创建 | 选中文字 → 弹出文档搜索 → 创建链接 |
| 自动建议 | 输入时自动匹配文档标题建议 |
| 出站链接 | 当前文档链接到的其他文档 |
| 反向链接 | 其他文档链接到当前文档 |
| 链接预览 | 悬浮显示链接文档预览卡片 |
| 链接点击 | 点击链接跳转到目标文档 |

#### 链接存储方案

内部存储 `documentId`，不使用特定语法格式：
- 编辑器中显示为可点击的链接样式
- 存储格式：`<a data-doc-id="uuid">文档标题</a>`
- 解析时提取 `data-doc-id` 建立链接关系

#### 目录大纲功能

| 功能 | 说明 |
|------|------|
| 自动提取 | 从 Markdown 提取 H1-H6 标题 |
| 大纲导航 | 侧边栏显示目录树 |
| 点击跳转 | 点击标题滚动到对应位置 |
| 高亮当前位置 | 滚动时高亮当前章节 |

#### 搜索增强功能

| 功能 | 说明 |
|------|------|
| 关键词高亮 | 搜索结果中高亮匹配词 |
| 上下文片段 | 显示匹配位置前后文本 |
| 高级筛选 | 时间范围、标签组合筛选 |

#### 数据库设计

```prisma
/// 双向链接
model BiLink {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  sourceDocId String   @map("source_doc_id") @db.Uuid
  targetDocId String   @map("target_doc_id") @db.Uuid
  linkText    String   @map("link_text") @db.VarChar(500)
  position    Json     @default("{}")  // { start: number, end: number }
  createdAt   DateTime @default(now()) @map("created_at")

  sourceDoc Document @relation("SourceLinks", fields: [sourceDocId], references: [id], onDelete: Cascade)
  targetDoc Document @relation("TargetLinks", fields: [targetDocId], references: [id], onDelete: Cascade)

  @@unique([sourceDocId, targetDocId])
  @@index([sourceDocId])
  @@index([targetDocId])
  @@map("bi_links")
}
```

#### API 设计

```
GET  /api/documents/:id/links           获取文档的出站链接
GET  /api/documents/:id/backlinks       获取文档的反向链接
POST /api/documents/:id/links           创建链接
DELETE /api/documents/:id/links/:linkId 删除链接

GET  /api/documents/:id/outline         获取文档目录大纲

GET  /api/search                        搜索（支持高亮、筛选）
```

---

### 4.4 Phase 3-3: 知识图谱

#### 图谱功能

| 功能 | 说明 |
|------|------|
| 文档节点 | 每个文档显示为一个节点 |
| 标签节点 | 标签作为独立节点类型 |
| 链接关系 | 文档间链接显示为连线 |
| 标签关联 | 文档-标签关系显示为连线 |
| 节点交互 | 点击节点跳转文档详情 |
| 缩放拖拽 | 支持缩放、平移、节点拖拽 |
| 筛选过滤 | 按标签、时间范围筛选 |
| 导出图片 | 导出为 PNG/SVG 图片 |

#### 最近文档功能

| 功能 | 说明 |
|------|------|
| 记录访问 | 记录最近访问的文档 |
| 快速访问 | 侧边栏显示最近文档列表 |
| 清除历史 | 支持清除访问历史 |

#### 技术选型

| 组件 | 选择 | 说明 |
|------|------|------|
| 图谱渲染 | React Flow | 易集成、交互好 |
| 导出图片 | html-to-image | PNG/SVG 导出 |
| 布局算法 | Dagre / ELK | 自动布局 |

#### API 设计

```
GET  /api/graph                        获取图谱数据（节点 + 边）
GET  /api/graph/filter                 筛选后的图谱数据

GET  /api/documents/recent             获取最近访问的文档
POST /api/documents/:id/visit          记录文档访问
```

---

### 4.5 Phase 3-4: 文件导入 + 优化

#### 文件导入功能

| 格式 | 解析方案 | 说明 |
|------|---------|------|
| `.md` | 原生支持 | 直接读取内容 |
| `.txt` | 原生支持 | 作为纯文本导入 |
| `.html` | 简单转换 | 提取文本内容 |
| `.docx` | mammoth | 转换为 Markdown |

| 功能 | 说明 |
|------|------|
| 单文件导入 | 选择单个文件上传解析 |
| 批量导入 | 选择多个文件批量上传 |
| 拖拽上传 | 拖拽文件到指定区域 |
| 导入预览 | 预览解析结果后确认 |
| 进度显示 | 显示导入进度 |

#### 导出功能

| 功能 | 说明 |
|------|------|
| 单文档导出 | 导出为 Markdown / HTML |
| 批量导出 | 导出多个文档为 ZIP |
| 导出选项 | 是否包含元数据、标签等 |

#### 数据备份功能

| 功能 | 说明 |
|------|------|
| 完整导出 | 导出所有数据为 JSON |
| 完整导入 | 从备份文件恢复数据 |
| 导出范围 | 选择导出范围（全部/部分） |
| 备份列表 | 显示历史备份记录（本地存储） |

#### 快捷键与交互优化

| 功能 | 说明 |
|------|------|
| 全局快捷键 | Cmd/Ctrl + N 新建、Cmd/Ctrl + S 保存等 |
| 自动保存状态 | 显示"已保存"/"保存中"/"保存失败" |
| 拖拽排序 | 文件夹/文档拖拽调整顺序 |
| 骨架屏 | 列表加载时显示骨架屏 |

#### API 设计

```
POST /api/import/upload              上传文件
POST /api/import/parse               解析文件内容
POST /api/import/batch               批量导入

GET  /api/export/document/:id        导出单个文档
POST /api/export/documents           批量导出文档

GET  /api/backup/export              导出全部数据
POST /api/backup/import              导入备份数据
```

---

## 5. 数据库 Schema 变更汇总

### 5.1 新增表

```prisma
/// 文档模板
model DocumentTemplate {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String   @db.VarChar(255)
  description String?  @db.Text
  category    String   @default("general") @db.VarChar(50)
  content     String   @default("") @db.Text
  thumbnail   String?  @db.VarChar(500)
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([category])
  @@map("document_templates")
}

/// 双向链接
model BiLink {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  sourceDocId String   @map("source_doc_id") @db.Uuid
  targetDocId String   @map("target_doc_id") @db.Uuid
  linkText    String   @map("link_text") @db.VarChar(500)
  position    Json     @default("{}")
  createdAt   DateTime @default(now()) @map("created_at")

  sourceDoc Document @relation("SourceLinks", fields: [sourceDocId], references: [id], onDelete: Cascade)
  targetDoc Document @relation("TargetLinks", fields: [targetDocId], references: [id], onDelete: Cascade)

  @@unique([sourceDocId, targetDocId])
  @@index([sourceDocId])
  @@index([targetDocId])
  @@map("bi_links")
}

/// 文档访问记录
model DocumentVisit {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  documentId String   @map("document_id") @db.Uuid
  visitedAt  DateTime @default(now()) @map("visited_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([visitedAt(sort: Desc)])
  @@map("document_visits")
}
```

### 5.2 现有表扩展

```prisma
// Document 表扩展
model Document {
  // ... 原有字段

  // Phase 3 新增字段
  isFavorite Boolean  @default(false) @map("is_favorite")
  isPinned   Boolean  @default(false) @map("is_pinned")

  // 关联扩展
  sourceLinks  BiLink[] @relation("SourceLinks")
  targetLinks  BiLink[] @relation("TargetLinks")
  visits       DocumentVisit[]
}

// Folder 表扩展
model Folder {
  // ... 原有字段

  // Phase 3 新增字段
  isPinned Boolean @default(false) @map("is_pinned")
}
```

---

## 6. 新增依赖汇总

### 后端 (apps/api)

| 包名 | 版本 | 引入阶段 | 用途 |
|------|------|---------|------|
| mammoth | ^1.6.0 | 3-4 | docx 文件解析 |
| archiver | ^6.0.0 | 3-4 | ZIP 打包导出 |
| adm-zip | ^0.5.10 | 3-4 | ZIP 解压导入 |

### 前端 (apps/web)

| 包名 | 版本 | 引入阶段 | 用途 |
|------|------|---------|------|
| @xyflow/react | ^12.0.0 | 3-3 | React Flow 图谱 |
| html-to-image | ^1.11.0 | 3-3 | 导出图片 |
| react-hotkeys-hook | ^4.5.0 | 3-4 | 快捷键管理 |
| react-dropzone | ^14.2.0 | 3-4 | 文件拖拽上传 |
| file-saver | ^2.0.5 | 3-4 | 文件下载 |
| jszip | ^3.10.0 | 3-4 | 前端 ZIP 处理 |

### shadcn/ui 组件

```
Checkbox, Popover, Command, Badge, Skeleton, Toast
```

---

## 7. 各子阶段工作量预估

| 子阶段 | 新增文件 | 后端 | 前端 | 共享包 |
|--------|---------|------|------|--------|
| 3-1a | ~12 | 5 files | 6 files | 1 file |
| 3-1b | ~8 | 4 files | 3 files | 1 file |
| 3-2 | ~16 | 6 files | 8 files | 2 files |
| 3-3 | ~10 | 2 files | 7 files | 1 file |
| 3-4 | ~14 | 7 files | 6 files | 1 file |
| **合计** | **~60** | **24** | **30** | **6** |

---

## 8. Phase 3 整体完成标准

完成全部 5 个子阶段后：

- [ ] 批量操作功能完整（移动、标签、归档、删除）
- [ ] 文档收藏和置顶功能可用
- [ ] 模板 CRUD 完整，可使用模板创建文档
- [ ] 文档复制功能可用
- [ ] 双向链接自动建立和展示
- [ ] 目录大纲自动提取和导航
- [ ] 搜索结果关键词高亮
- [ ] 知识图谱可视化并支持导出图片
- [ ] 最近文档快速访问
- [ ] 多格式文件批量导入
- [ ] 文档导出功能（Markdown/HTML/ZIP）
- [ ] 数据完整备份和恢复
- [ ] 快捷键支持
- [ ] 自动保存状态显示
- [ ] 所有后端 API 通过 Swagger 文档可测试

---

## 9. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **批量操作性能** | 大数据量卡顿 | 中 | 1. 分批处理<br>2. 进度提示<br>3. 后台任务 |
| **链接解析准确性** | 链接关系错误 | 中 | 1. 增量解析<br>2. 手动修正入口 |
| **图谱渲染性能** | 节点多时卡顿 | 中 | 1. 虚拟化渲染<br>2. 节点数量限制<br>3. 分层展示 |
| **文件解析失败** | 导入功能不可用 | 低 | 1. 错误提示<br>2. 支持格式限制<br>3. 解析预览 |
| **备份数据过大** | 导出/导入慢 | 低 | 1. 分片导出<br>2. 压缩处理 |

---

## 10. 文件产出清单总览

```
Phase 3 总计：新增 ~60 文件，修改 ~15 文件

=== Phase 3-1a (12 files) ===
新增:
├── apps/api/src/modules/documents/
│   ├── dto/batch-move.dto.ts
│   ├── dto/batch-tag.dto.ts
│   └── documents-batch.service.ts
├── apps/api/src/modules/favorites/
│   ├── favorites.module.ts
│   ├── favorites.service.ts
│   └── favorites.controller.ts
├── apps/web/components/documents/
│   ├── document-selector.tsx
│   ├── batch-actions-bar.tsx
│   └── favorite-button.tsx
├── apps/web/components/layout/
│   └── favorites-sidebar.tsx
└── packages/shared/src/types/
    └── batch.ts

修改:
├── apps/api/prisma/schema.prisma
├── apps/api/src/modules/documents/documents.service.ts
├── apps/web/app/(main)/documents/page.tsx
└── packages/shared/src/types/index.ts

=== Phase 3-1b (8 files) ===
新增:
├── apps/api/src/modules/templates/
│   ├── templates.module.ts
│   ├── templates.service.ts
│   ├── templates.controller.ts
│   └── dto/create-template.dto.ts
├── apps/web/components/templates/
│   ├── template-list.tsx
│   ├── template-card.tsx
│   └── template-dialog.tsx
└── packages/shared/src/types/
    └── template.ts

修改:
├── apps/api/prisma/schema.prisma
├── apps/web/app/(main)/documents/new/page.tsx
└── packages/shared/src/types/index.ts

=== Phase 3-2 (16 files) ===
新增:
├── apps/api/src/modules/links/
│   ├── links.module.ts
│   ├── links.service.ts
│   ├── links.controller.ts
│   └── dto/create-link.dto.ts
├── apps/api/src/modules/documents/
│   └── outline.service.ts
├── apps/web/components/links/
│   ├── link-suggest.tsx
│   ├── backlinks-panel.tsx
│   ├── outbound-links.tsx
│   └── link-preview-card.tsx
├── apps/web/components/documents/
│   ├── document-outline.tsx
│   └── search-highlight.tsx
├── apps/web/components/search/
│   └── advanced-filter.tsx
├── apps/web/hooks/
│   └── use-links.ts
└── packages/shared/src/types/
    ├── link.ts
    └── outline.ts

修改:
├── apps/api/prisma/schema.prisma
├── apps/api/src/modules/search/search.service.ts
├── apps/web/app/(main)/documents/[id]/page.tsx
├── apps/web/app/(main)/search/page.tsx
└── packages/shared/src/types/index.ts

=== Phase 3-3 (10 files) ===
新增:
├── apps/api/src/modules/graph/
│   ├── graph.module.ts
│   ├── graph.service.ts
│   └── graph.controller.ts
├── apps/web/components/graph/
│   ├── knowledge-graph.tsx
│   ├── graph-node.tsx
│   ├── graph-edge.tsx
│   ├── graph-controls.tsx
│   └── graph-export.tsx
├── apps/web/components/layout/
│   └── recent-documents.tsx
└── packages/shared/src/types/
    └── graph.ts

修改:
├── apps/api/prisma/schema.prisma
├── apps/web/app/(main)/layout.tsx
├── apps/web/components/layout/sidebar.tsx
└── packages/shared/src/types/index.ts

=== Phase 3-4 (14 files) ===
新增:
├── apps/api/src/modules/import/
│   ├── import.module.ts
│   ├── import.service.ts
│   ├── import.controller.ts
│   └── parsers/
│       ├── md.parser.ts
│       ├── txt.parser.ts
│       ├── html.parser.ts
│       └── docx.parser.ts
├── apps/api/src/modules/export/
│   ├── export.module.ts
│   ├── export.service.ts
│   └── export.controller.ts
├── apps/api/src/modules/backup/
│   ├── backup.module.ts
│   ├── backup.service.ts
│   └── backup.controller.ts
├── apps/web/components/import/
│   ├── file-uploader.tsx
│   ├── import-dialog.tsx
│   └── import-progress.tsx
├── apps/web/components/backup/
│   ├── backup-dialog.tsx
│   └── restore-dialog.tsx
├── apps/web/hooks/
│   ├── use-keyboard-shortcuts.ts
│   └── use-auto-save.ts
└── packages/shared/src/types/
    └── import.ts

修改:
├── apps/web/app/(main)/documents/page.tsx
├── apps/web/app/(main)/documents/[id]/page.tsx
├── apps/web/components/layout/sidebar.tsx
└── packages/shared/src/types/index.ts
```

---

## 11. 开发优先级建议

```
优先级排序：

P0 (核心功能)：
  1. Phase 3-1a: 批量操作 + 收藏置顶
  2. Phase 3-2: 双向链接 + 目录大纲 + 搜索增强
  3. Phase 3-4: 文件导入 + 数据备份

P1 (增强功能)：
  4. Phase 3-1b: 模板系统
  5. Phase 3-3: 知识图谱

建议执行顺序：
  3-1a → 3-2 → 3-4 → 3-1b → 3-3
  （3-1b 和 3-3 可根据实际情况调整顺序）
```
