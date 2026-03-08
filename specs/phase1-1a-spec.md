# Phase 1-1a Spec: 后端 CRUD API + 前端布局 Shell

## 1. 目标

构建完整的后端数据管理 API（文件夹、文档、标签三组 CRUD），并搭建前端应用的布局骨架。完成后：

- 所有数据实体可通过 REST API 操作
- Swagger 文档可查看和测试全部 API
- 前端应用具备 Sidebar + Content 的基础布局框架
- 全局状态管理就绪

---

## 2. 前置条件

- Phase 0 全部完成
- Docker 服务运行中（PostgreSQL + Meilisearch）
- 数据库 Schema 已同步（7 张表就绪）

---

## 3. Module 1: 文件夹 CRUD API

### 3.1 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/folders` | 获取文件夹树（完整树状结构） |
| GET | `/api/v1/folders/:id` | 获取单个文件夹详情（含子文件夹和文档数） |
| POST | `/api/v1/folders` | 创建文件夹 |
| PATCH | `/api/v1/folders/:id` | 更新文件夹（重命名、移动） |
| DELETE | `/api/v1/folders/:id` | 删除文件夹（级联删除子文件夹，文档移至未分类） |
| PATCH | `/api/v1/folders/reorder` | 批量调整文件夹排序 |

### 3.2 DTO 定义

```typescript
// create-folder.dto.ts
import { IsString, IsOptional, IsUUID, IsInt, MinLength, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// update-folder.dto.ts
import { PartialType } from '@nestjs/swagger';
export class UpdateFolderDto extends PartialType(CreateFolderDto) {}

// reorder-folders.dto.ts
import { IsArray, ValidateNested, IsUUID, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderItem {
  @IsUUID()
  id: string;

  @IsInt()
  sortOrder: number;
}

export class ReorderFoldersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
```

### 3.3 Service 核心逻辑

```typescript
// folders.service.ts 关键方法

// 获取完整文件夹树
async getTree(): Promise<FolderTreeNode[]> {
  const folders = await this.prisma.folder.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { documents: true } } },
  });
  return this.buildTree(folders, null);
}

// 递归构建树
private buildTree(folders: FolderWithCount[], parentId: string | null): FolderTreeNode[] {
  return folders
    .filter(f => f.parentId === parentId)
    .map(f => ({
      ...f,
      children: this.buildTree(folders, f.id),
    }));
}

// 创建文件夹（含同名检测和层级限制）
async create(dto: CreateFolderDto): Promise<Folder> {
  // 1. 检查同一父级下是否有同名文件夹
  // 2. 如果有 parentId，检查嵌套层级 <= 5
  // 3. 创建文件夹
}

// 更新文件夹（含循环引用检测）
async update(id: string, dto: UpdateFolderDto): Promise<Folder> {
  // 1. 如果移动（parentId 改变），检查不是移到自己的子树下
  // 2. 检查同名
  // 3. 检查层级
  // 4. 更新
}

// 删除文件夹（文档移至未分类）
async remove(id: string): Promise<void> {
  // 1. 找到所有子孙文件夹 ID
  // 2. 将这些文件夹下的文档 folderId 设为 null
  // 3. 级联删除文件夹
}
```

### 3.4 业务规则

- 文件夹最大嵌套层级：5 层
- 同一父级下文件夹名不可重复
- 不允许将文件夹移动到自身或子文件夹下（防循环引用）
- 删除时子文件夹级联删除，其下文档 `folderId` 置为 `null`

### 3.5 文件产出

| 文件 | 说明 |
|------|------|
| `apps/api/src/modules/folders/folders.module.ts` | 模块定义 |
| `apps/api/src/modules/folders/folders.controller.ts` | 控制器（6 个端点） |
| `apps/api/src/modules/folders/folders.service.ts` | 业务逻辑 |
| `apps/api/src/modules/folders/dto/create-folder.dto.ts` | 创建 DTO |
| `apps/api/src/modules/folders/dto/update-folder.dto.ts` | 更新 DTO |
| `apps/api/src/modules/folders/dto/reorder-folders.dto.ts` | 排序 DTO |

---

## 4. Module 2: 文档 CRUD API

### 4.1 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/documents` | 文档列表（分页、过滤、排序） |
| GET | `/api/v1/documents/:id` | 获取文档详情（含标签、文件夹信息） |
| POST | `/api/v1/documents` | 创建文档 |
| PATCH | `/api/v1/documents/:id` | 更新文档 |
| DELETE | `/api/v1/documents/:id` | 删除文档（软删除 → 归档） |
| DELETE | `/api/v1/documents/:id/permanent` | 永久删除文档 |
| PATCH | `/api/v1/documents/:id/archive` | 归档/取消归档切换 |
| PATCH | `/api/v1/documents/:id/move` | 移动文档到目标文件夹 |
| GET | `/api/v1/documents/recent` | 最近编辑的文档（limit=10） |

### 4.2 DTO 定义

```typescript
// create-document.dto.ts
export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsIn(['manual', 'import', 'clip'])
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

// query-document.dto.ts
export class QueryDocumentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title', 'wordCount'])
  sort?: string = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string = 'desc';
}
```

### 4.3 Service 核心逻辑

```typescript
// documents.service.ts 关键方法

// 文档列表（分页 + 过滤）
async findAll(query: QueryDocumentDto): Promise<PaginatedResponse<DocumentSummary>> {
  const where: Prisma.DocumentWhereInput = {
    isArchived: query.isArchived ?? false,
    ...(query.folderId && { folderId: query.folderId }),
    ...(query.tagId && { tags: { some: { tagId: query.tagId } } }),
  };

  const [items, total] = await Promise.all([
    this.prisma.document.findMany({
      where,
      select: {
        id: true, title: true, contentPlain: true,  // contentPlain 截取前 200 字符作摘要
        folderId: true, wordCount: true, isArchived: true,
        createdAt: true, updatedAt: true,
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    this.prisma.document.count({ where }),
  ]);

  return {
    items: items.map(this.toSummary),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

// 创建文档（自动提取纯文本 + 计算字数）
async create(dto: CreateDocumentDto): Promise<Document> {
  const contentPlain = extractPlainText(dto.content || '');
  const wordCount = countWords(contentPlain);

  return this.prisma.document.create({
    data: {
      title: dto.title,
      content: dto.content || '',
      contentPlain,
      wordCount,
      sourceType: dto.sourceType || 'manual',
      sourceUrl: dto.sourceUrl,
      folderId: dto.folderId || null,
      tags: dto.tagIds?.length ? {
        create: dto.tagIds.map(tagId => ({ tagId })),
      } : undefined,
    },
    include: { folder: true, tags: { include: { tag: true } } },
  });
}

// 更新文档（标签使用 deleteMany + createMany 全量替换）
async update(id: string, dto: UpdateDocumentDto): Promise<Document> {
  // 1. 如果 content 更新，重新提取纯文本和字数
  // 2. 如果 tagIds 提供，先删除所有关联再重建
  // 3. 更新文档
}
```

### 4.4 文本处理工具

```typescript
// apps/api/src/common/utils/text.utils.ts

/**
 * 从 Markdown 中提取纯文本（移除标记符号）
 */
export function extractPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')    // 移除代码块
    .replace(/`[^`]*`/g, '')           // 移除行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '')   // 移除图片
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')  // 链接保留文字
    .replace(/#{1,6}\s/g, '')          // 移除标题标记
    .replace(/[*_~]+/g, '')            // 移除粗体/斜体/删除线
    .replace(/>\s/g, '')               // 移除引用标记
    .replace(/[-*+]\s/g, '')           // 移除列表标记
    .replace(/\|.*?\|/g, '')           // 移除表格
    .replace(/\n{2,}/g, '\n')          // 合并空行
    .trim();
}

/**
 * 统计字数（中文按字计数，英文按词计数）
 */
export function countWords(text: string): number {
  const chinese = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  const english = text.replace(/[\u4e00-\u9fa5]/g, '').match(/\b\w+\b/g)?.length || 0;
  return chinese + english;
}
```

### 4.5 业务规则

- 保存文档自动提取 `contentPlain` 和计算 `wordCount`
- 列表返回摘要（`contentPlain` 前 200 字符），不返回全文 `content`
- `DELETE /documents/:id` 为软删除（设 `isArchived = true`）
- `DELETE /documents/:id/permanent` 为真正的物理删除
- `tagIds` 更新为全量替换方式（先清空再重建）

### 4.6 文件产出

| 文件 | 说明 |
|------|------|
| `apps/api/src/modules/documents/documents.module.ts` | 模块定义 |
| `apps/api/src/modules/documents/documents.controller.ts` | 控制器（9 个端点） |
| `apps/api/src/modules/documents/documents.service.ts` | 业务逻辑 |
| `apps/api/src/modules/documents/dto/create-document.dto.ts` | 创建 DTO |
| `apps/api/src/modules/documents/dto/update-document.dto.ts` | 更新 DTO |
| `apps/api/src/modules/documents/dto/query-document.dto.ts` | 查询 DTO |
| `apps/api/src/common/utils/text.utils.ts` | 文本处理工具 |

---

## 5. Module 3: 标签 CRUD API

### 5.1 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tags` | 获取所有标签（含关联文档计数） |
| POST | `/api/v1/tags` | 创建标签 |
| PATCH | `/api/v1/tags/:id` | 更新标签（改名、换色） |
| DELETE | `/api/v1/tags/:id` | 删除标签（仅删标签，不影响文档） |
| GET | `/api/v1/tags/:id/documents` | 获取标签下的文档列表（分页） |

### 5.2 DTO 定义

```typescript
// create-tag.dto.ts
export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;  // 默认服务端随机生成
}

// update-tag.dto.ts
export class UpdateTagDto extends PartialType(CreateTagDto) {}
```

### 5.3 Service 核心逻辑

```typescript
// tags.service.ts

async findAll(): Promise<TagWithCount[]> {
  return this.prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { documents: true } } },
  });
}

async create(dto: CreateTagDto): Promise<Tag> {
  // 默认颜色：从预设色板中随机选取
  const color = dto.color || this.randomColor();
  return this.prisma.tag.create({
    data: { name: dto.name, color },
  });
}

async remove(id: string): Promise<void> {
  // Prisma schema 中 DocumentTag onDelete: Cascade
  // 删除 Tag 会自动清除 document_tags 关联
  await this.prisma.tag.delete({ where: { id } });
}
```

### 5.4 文件产出

| 文件 | 说明 |
|------|------|
| `apps/api/src/modules/tags/tags.module.ts` | 模块定义 |
| `apps/api/src/modules/tags/tags.controller.ts` | 控制器（5 个端点） |
| `apps/api/src/modules/tags/tags.service.ts` | 业务逻辑 |
| `apps/api/src/modules/tags/dto/create-tag.dto.ts` | 创建 DTO |
| `apps/api/src/modules/tags/dto/update-tag.dto.ts` | 更新 DTO |

---

## 6. Module 4: 前端布局 Shell

### 6.1 布局结构

```
┌─────────────────────────────────────────────────────────┐
│  TopBar: [搜索框(placeholder)]              [设置图标]  │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Sidebar     │  Main Content Area                       │
│  (240px)     │  (flex-1)                                │
│              │                                          │
│  ┌────────┐  │  ┌──────────────────────────────────┐   │
│  │文件夹   │  │  │  {children} - 由路由决定内容      │   │
│  │(占位)   │  │  │                                    │   │
│  └────────┘  │  │                                    │   │
│              │  └──────────────────────────────────┘   │
│  ┌────────┐  │                                          │
│  │标签     │  │                                          │
│  │(占位)   │  │                                          │
│  └────────┘  │                                          │
│              │                                          │
│  [+ 新文档]  │                                          │
├──────────────┴──────────────────────────────────────────┤
│  StatusBar (可选)                                        │
└─────────────────────────────────────────────────────────┘
```

> 注：此阶段 Sidebar 内的文件夹树和标签列表用占位组件，Phase 1-1b 再实现。

### 6.2 路由规划

```
app/
├── (main)/                    # 主应用路由组
│   ├── layout.tsx             # Sidebar + TopBar + Content 布局
│   ├── page.tsx               # / → 重定向到 /documents
│   └── documents/
│       └── page.tsx           # /documents → 文档列表（占位）
├── layout.tsx                 # 根布局（已有）
├── page.tsx                   # 首页（保留 Phase 0 服务状态页）
└── providers.tsx              # 已有
```

### 6.3 Zustand Store

```typescript
// stores/app-store.ts
import { create } from 'zustand';

interface AppStore {
  // 侧边栏
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // 选中状态
  selectedFolderId: string | null;
  selectedTagId: string | null;
  selectFolder: (id: string | null) => void;
  selectTag: (id: string | null) => void;

  // 视图模式
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  selectedFolderId: null,
  selectedTagId: null,
  selectFolder: (id) => set({ selectedFolderId: id, selectedTagId: null }),
  selectTag: (id) => set({ selectedTagId: id, selectedFolderId: null }),

  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),
}));
```

### 6.4 新增依赖

```bash
# 前端
pnpm --filter @kb/web add zustand

# shadcn/ui 基础组件（按实际需要安装）
# 在 apps/web 目录执行
npx shadcn-ui@latest add button input dialog separator scroll-area tooltip skeleton
```

### 6.5 文件产出

| 文件 | 说明 |
|------|------|
| `apps/web/app/(main)/layout.tsx` | 主应用布局 |
| `apps/web/app/(main)/page.tsx` | 根路由重定向 |
| `apps/web/app/(main)/documents/page.tsx` | 文档列表页（占位） |
| `apps/web/components/layout/sidebar.tsx` | 侧边栏容器 |
| `apps/web/components/layout/topbar.tsx` | 顶部导航栏 |
| `apps/web/stores/app-store.ts` | Zustand 状态 |

---

## 7. 共享类型更新

在 `packages/shared/src/types/api.ts` 中新增：

```typescript
// ========================
// 通用
// ========================
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ========================
// 文件夹
// ========================
export interface CreateFolderRequest {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateFolderRequest {
  name?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  children: FolderTreeNode[];
  _count: { documents: number };
  createdAt: string;
  updatedAt: string;
}

// ========================
// 文档
// ========================
export interface CreateDocumentRequest {
  title: string;
  content?: string;
  folderId?: string;
  tagIds?: string[];
  sourceType?: 'manual' | 'import' | 'clip';
  sourceUrl?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  folderId?: string;
  tagIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface DocumentQueryParams extends PaginationParams {
  folderId?: string;
  tagId?: string;
  isArchived?: boolean;
  sort?: 'createdAt' | 'updatedAt' | 'title' | 'wordCount';
  order?: 'asc' | 'desc';
}

export interface DocumentSummary {
  id: string;
  title: string;
  summary: string;       // contentPlain 前 200 字符
  folderId: string | null;
  folder: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
  wordCount: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends Omit<DocumentSummary, 'summary'> {
  content: string;
  contentPlain: string;
  sourceType: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
}

// ========================
// 标签
// ========================
export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

export interface TagWithCount {
  id: string;
  name: string;
  color: string;
  _count: { documents: number };
  createdAt: string;
}
```

---

## 8. App Module 更新

`app.module.ts` 需要导入新增的 3 个模块：

```typescript
import { FoldersModule } from './modules/folders/folders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { TagsModule } from './modules/tags/tags.module';

@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    ThrottlerModule.forRoot([{ ... }]),
    PrismaModule,
    HealthModule,
    FoldersModule,    // 新增
    DocumentsModule,  // 新增
    TagsModule,       // 新增
  ],
})
export class AppModule {}
```

---

## 9. 全量文件产出清单

```
Phase 1-1a 新增/修改文件（~22 个）

后端新增 (16 files)
├── src/modules/folders/
│   ├── folders.module.ts
│   ├── folders.controller.ts
│   ├── folders.service.ts
│   ├── dto/create-folder.dto.ts
│   ├── dto/update-folder.dto.ts
│   └── dto/reorder-folders.dto.ts
├── src/modules/documents/
│   ├── documents.module.ts
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── dto/create-document.dto.ts
│   ├── dto/update-document.dto.ts
│   └── dto/query-document.dto.ts
├── src/modules/tags/
│   ├── tags.module.ts
│   ├── tags.controller.ts
│   ├── tags.service.ts
│   ├── dto/create-tag.dto.ts
│   └── dto/update-tag.dto.ts
└── src/common/utils/
    └── text.utils.ts

后端修改 (1 file)
└── src/app.module.ts           # 导入 3 个新模块

前端新增 (5 files)
├── app/(main)/layout.tsx
├── app/(main)/page.tsx
├── app/(main)/documents/page.tsx
├── components/layout/sidebar.tsx
├── components/layout/topbar.tsx
└── stores/app-store.ts

共享包修改 (1 file)
└── packages/shared/src/types/api.ts
```

---

## 10. 验证方案

### 10.1 后端验证

```bash
# 1. 构建成功
cd apps/api && npx nest build

# 2. 启动服务
npx nest start

# 3. 文件夹 API 测试
curl -X POST http://localhost:4000/api/v1/folders \
  -H "Content-Type: application/json" \
  -d '{"name":"测试文件夹"}'
# 预期：返回创建的文件夹对象

curl http://localhost:4000/api/v1/folders
# 预期：返回文件夹树

# 4. 文档 API 测试
curl -X POST http://localhost:4000/api/v1/documents \
  -H "Content-Type: application/json" \
  -d '{"title":"测试文档","content":"# Hello\n这是**测试**"}'
# 预期：返回文档对象，wordCount > 0，contentPlain 不含 Markdown 标记

curl "http://localhost:4000/api/v1/documents?page=1&limit=10"
# 预期：返回分页结果

# 5. 标签 API 测试
curl -X POST http://localhost:4000/api/v1/tags \
  -H "Content-Type: application/json" \
  -d '{"name":"TypeScript"}'
# 预期：返回标签对象

curl http://localhost:4000/api/v1/tags
# 预期：返回标签列表，含 _count.documents

# 6. Swagger 文档
# 浏览器打开 http://localhost:4000/api/docs
# 预期：显示全部 20 个 API 端点
```

### 10.2 前端验证

```bash
# 启动前端
cd apps/web && npx next dev

# 浏览器打开 http://localhost:3000/documents
# 预期：
# - 左侧显示 Sidebar（含占位内容）
# - 右侧显示文档列表（占位）
# - 顶部显示 TopBar
# - Sidebar 可以展开/收起
```

---

## 11. 完成标准

- [ ] 文件夹 API 6 个端点全部可用（含嵌套限制、循环引用检测）
- [ ] 文档 API 9 个端点全部可用（含分页、过滤、软删除）
- [ ] 标签 API 5 个端点全部可用（含文档计数）
- [ ] 文本工具函数正确提取纯文本和计算字数
- [ ] `nest build` 无错误
- [ ] Swagger 文档显示全部新增端点
- [ ] 前端布局 Shell 可正常渲染（Sidebar + TopBar + Content）
- [ ] Zustand store 正常工作
