# Phase 1-2 Spec: Meilisearch 全文搜索 + 文档预览

## 1. 目标

集成 Meilisearch 全文搜索引擎，实现文档内容的快速检索和结果高亮。同时提供 Markdown 文档的只读预览渲染。完成后：

- 用户可通过 Cmd+K 全局搜索框快速搜索文档
- 搜索支持中文分词和模糊匹配
- 搜索结果高亮显示匹配关键词
- 文档可以 Markdown 渲染方式只读预览

---

## 2. 前置条件

- Phase 1-1b 全部完成
- Meilisearch 容器运行中（端口 7700）
- 文档 CRUD API 可用

---

## 3. Module 1: 后端 Meilisearch 集成

### 3.1 Meilisearch 客户端服务

```typescript
// apps/api/src/modules/search/meili.service.ts

@Injectable()
export class MeiliService implements OnModuleInit {
  private client: MeiliSearch;
  private index: Index;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.client = new MeiliSearch({
      host: this.config.get('MEILI_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILI_API_KEY'),
    });

    this.index = this.client.index('documents');

    // 配置索引设置
    await this.index.updateSettings({
      searchableAttributes: ['title', 'contentPlain', 'tags'],
      filterableAttributes: ['folderId', 'tagIds', 'isArchived', 'sourceType'],
      sortableAttributes: ['createdAt', 'updatedAt', 'wordCount'],
      // 中文分词使用 Meilisearch 内置的 jieba
    });
  }

  // 索引单个文档
  async indexDocument(doc: MeiliDocument): Promise<void> {
    await this.index.addDocuments([doc]);
  }

  // 批量索引
  async indexDocuments(docs: MeiliDocument[]): Promise<void> {
    await this.index.addDocuments(docs);
  }

  // 删除索引文档
  async removeDocument(id: string): Promise<void> {
    await this.index.deleteDocument(id);
  }

  // 搜索
  async search(query: string, options: SearchOptions): Promise<SearchResponse> {
    return this.index.search(query, {
      limit: options.limit || 20,
      offset: ((options.page || 1) - 1) * (options.limit || 20),
      filter: this.buildFilter(options),
      sort: options.sort ? [`${options.sort}:${options.order || 'desc'}`] : undefined,
      attributesToHighlight: ['title', 'contentPlain'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      attributesToCrop: ['contentPlain'],
      cropLength: 200,
    });
  }

  // 全量重建索引
  async reindexAll(documents: MeiliDocument[]): Promise<void> {
    await this.index.deleteAllDocuments();
    if (documents.length > 0) {
      // 分批索引，每批 500 条
      for (let i = 0; i < documents.length; i += 500) {
        await this.index.addDocuments(documents.slice(i, i + 500));
      }
    }
  }

  private buildFilter(options: SearchOptions): string[] {
    const filters: string[] = [];
    if (options.folderId) filters.push(`folderId = "${options.folderId}"`);
    if (options.tagIds) {
      options.tagIds.split(',').forEach(id =>
        filters.push(`tagIds = "${id.trim()}"`)
      );
    }
    filters.push('isArchived = false');
    return filters;
  }
}
```

### 3.2 Meilisearch 文档结构

```typescript
interface MeiliDocument {
  id: string;
  title: string;
  contentPlain: string;
  folderId: string | null;
  folderName: string | null;
  tagIds: string[];
  tags: string[];           // 标签名数组，支持按标签名搜索
  sourceType: string;
  isArchived: boolean;
  wordCount: number;
  createdAt: number;        // Unix 时间戳（秒）
  updatedAt: number;
}
```

### 3.3 搜索 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/search` | 全文搜索文档 |
| POST | `/api/v1/search/reindex` | 全量重建索引 |

### 3.4 搜索 DTO

```typescript
// dto/search-query.dto.ts
export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  q: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsString()
  tagIds?: string;

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
}
```

### 3.5 搜索响应

```typescript
interface SearchResultResponse {
  hits: {
    id: string;
    title: string;
    contentPlain: string;
    folderId: string | null;
    folderName: string | null;
    tags: string[];
    updatedAt: number;
    _formatted: {           // Meilisearch 高亮结果
      title: string;        // 含 <mark> 标签
      contentPlain: string; // 含 <mark> 标签，已裁剪
    };
  }[];
  query: string;
  estimatedTotalHits: number;
  processingTimeMs: number;
  page: number;
  limit: number;
}
```

### 3.6 文档 CRUD 同步接入

修改 Phase 1-1a 的 `DocumentsService`，在文档创建/更新/删除时同步 Meilisearch：

```typescript
// documents.service.ts 修改

constructor(
  private prisma: PrismaService,
  private meili: MeiliService,   // 注入搜索服务
) {}

async create(dto: CreateDocumentDto): Promise<Document> {
  const doc = await this.prisma.document.create({ ... });
  // 异步同步到 Meilisearch（不阻塞响应）
  this.syncToMeili(doc).catch(err =>
    this.logger.warn('Meilisearch sync failed', err.message)
  );
  return doc;
}

async update(id: string, dto: UpdateDocumentDto): Promise<Document> {
  const doc = await this.prisma.document.update({ ... });
  this.syncToMeili(doc).catch(err =>
    this.logger.warn('Meilisearch sync failed', err.message)
  );
  return doc;
}

async removePermanent(id: string): Promise<void> {
  await this.prisma.document.delete({ where: { id } });
  this.meili.removeDocument(id).catch(err =>
    this.logger.warn('Meilisearch delete failed', err.message)
  );
}

private async syncToMeili(doc: DocumentWithRelations): Promise<void> {
  await this.meili.indexDocument({
    id: doc.id,
    title: doc.title,
    contentPlain: doc.contentPlain,
    folderId: doc.folderId,
    folderName: doc.folder?.name || null,
    tagIds: doc.tags.map(t => t.tagId),
    tags: doc.tags.map(t => t.tag.name),
    sourceType: doc.sourceType,
    isArchived: doc.isArchived,
    wordCount: doc.wordCount,
    createdAt: Math.floor(doc.createdAt.getTime() / 1000),
    updatedAt: Math.floor(doc.updatedAt.getTime() / 1000),
  });
}
```

**容错**: Meilisearch 同步失败时仅打印警告日志，不影响主流程。

### 3.7 后端文件产出

| 文件 | 说明 |
|------|------|
| `apps/api/src/modules/search/search.module.ts` | 搜索模块 |
| `apps/api/src/modules/search/search.controller.ts` | 搜索控制器 |
| `apps/api/src/modules/search/search.service.ts` | 搜索业务逻辑 |
| `apps/api/src/modules/search/meili.service.ts` | Meilisearch 客户端 |
| `apps/api/src/modules/search/dto/search-query.dto.ts` | 搜索 DTO |

### 3.8 修改文件

| 文件 | 修改内容 |
|------|---------|
| `apps/api/src/app.module.ts` | 导入 SearchModule |
| `apps/api/src/modules/documents/documents.module.ts` | 导入 SearchModule，注入 MeiliService |
| `apps/api/src/modules/documents/documents.service.ts` | 添加 Meilisearch 同步逻辑 |

### 3.9 新增依赖

```bash
pnpm --filter @kb/api add meilisearch
```

---

## 4. Module 2: 前端搜索 UI

### 4.1 搜索交互流程

```
1. 用户按 Cmd+K / Ctrl+K（或点击 TopBar 搜索框）
2. 弹出搜索命令面板（Command Palette 风格）
3. 输入关键词 → 防抖 300ms → 请求后端搜索 API
4. 显示搜索结果列表（标题高亮 + 内容片段高亮）
5. 键盘 ↑↓ 导航，Enter 跳转到文档
6. Escape 关闭面板
```

### 4.2 组件结构

```
<SearchCommand>                     # 全局搜索弹窗（Dialog/Command）
  ├── <SearchInput>                 # 搜索输入框 + 快捷键提示
  ├── <SearchFilters>               # 可选过滤（文件夹/标签下拉）
  ├── <SearchResults>
  │     └── <SearchResultItem>      # 单条结果
  │           ├── 标题（含 <mark> 高亮）
  │           ├── 内容摘要（含 <mark> 高亮）
  │           ├── 文件夹名
  │           └── 更新时间
  ├── <SearchEmpty>                 # 无结果状态
  └── <SearchLoading>               # 搜索中状态
```

### 4.3 搜索结果页

除命令面板外，提供独立搜索结果页 `/search?q=xxx`，展示更详细的搜索结果：

```
<SearchPage>                        # app/(main)/search/page.tsx
  ├── 搜索词回显 + 结果计数 + 耗时
  ├── 过滤器（文件夹/标签）
  └── <SearchResultList>
        └── <SearchResultCard>      # 更详细的结果卡片
              ├── 标题（高亮）
              ├── 内容摘要（高亮，更长）
              ├── 标签 Badge 列表
              ├── 文件夹路径
              └── 更新时间
```

### 4.4 React Query Hook

```typescript
// hooks/use-search.ts
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from './use-debounced-value';

export function useSearch(query: string, options?: SearchOptions) {
  const debouncedQuery = useDebouncedValue(query, 300);

  return useQuery({
    queryKey: ['search', debouncedQuery, options],
    queryFn: () => apiClient.get('/v1/search', {
      params: { q: debouncedQuery, ...options },
    }).then(r => r.data),
    enabled: debouncedQuery.length > 0,
  });
}
```

### 4.5 高亮渲染

Meilisearch 返回的高亮使用 `<mark>` 标签，前端使用 `dangerouslySetInnerHTML` 渲染（搜索结果来自受信数据源）：

```tsx
function HighlightedText({ html }: { html: string }) {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className="[&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 dark:[&>mark]:bg-yellow-800 dark:[&>mark]:text-yellow-100"
    />
  );
}
```

---

## 5. Module 3: 文档 Markdown 预览

### 5.1 功能说明

在文档列表点击文档后，可查看 Markdown 渲染后的预览效果（只读）。此预览组件也将在 Phase 1-3 的分屏编辑器中复用。

### 5.2 Markdown 渲染配置

```typescript
// components/documents/markdown-preview.tsx

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <article className="prose prose-gray dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
```

支持的 Markdown 特性：
- 标题（h1-h6）
- 粗体、斜体、删除线
- 有序/无序列表
- 链接和图片
- 代码块（语法高亮）
- 表格（GFM）
- 引用块
- 分隔线
- 任务列表

### 5.3 文档编辑页更新

将 Phase 1-1b 的临时 textarea 页面增加预览切换：

```
<DocumentEditPage>
  ├── <Header>
  │     ├── [← 返回]
  │     ├── 标题输入
  │     ├── <TagSelector>
  │     ├── [编辑 | 预览] 切换    ← 新增
  │     └── [保存]
  └── 内容区域
        ├── mode=edit  → <textarea>           # 临时编辑器
        └── mode=preview → <MarkdownPreview>   # Markdown 渲染预览
```

### 5.4 新增前端依赖

```bash
pnpm --filter @kb/web add react-markdown remark-gfm rehype-highlight react-syntax-highlighter
pnpm --filter @kb/web add -D @types/react-syntax-highlighter
```

### 5.5 文件产出

| 文件 | 说明 |
|------|------|
| `apps/web/app/(main)/search/page.tsx` | 搜索结果页 |
| `apps/web/components/search/search-command.tsx` | Cmd+K 搜索弹窗 |
| `apps/web/components/search/search-result-item.tsx` | 搜索结果项 |
| `apps/web/components/documents/markdown-preview.tsx` | Markdown 预览组件 |
| `apps/web/hooks/use-search.ts` | 搜索 Hook（含防抖） |

### 5.6 修改文件

| 文件 | 修改内容 |
|------|---------|
| `apps/web/components/layout/topbar.tsx` | 集成搜索触发按钮和 Cmd+K 快捷键 |
| `apps/web/app/(main)/documents/[id]/page.tsx` | 添加编辑/预览切换 |
| `apps/web/app/(main)/layout.tsx` | 挂载 SearchCommand 组件 |

---

## 6. 全量文件产出清单

```
Phase 1-2 新增/修改文件（~13 个）

后端新增 (5 files)
├── src/modules/search/
│   ├── search.module.ts
│   ├── search.controller.ts
│   ├── search.service.ts
│   ├── meili.service.ts
│   └── dto/search-query.dto.ts

后端修改 (3 files)
├── src/app.module.ts
├── src/modules/documents/documents.module.ts
└── src/modules/documents/documents.service.ts

前端新增 (5 files)
├── app/(main)/search/page.tsx
├── components/search/search-command.tsx
├── components/search/search-result-item.tsx
├── components/documents/markdown-preview.tsx
└── hooks/use-search.ts

前端修改 (3 files)
├── components/layout/topbar.tsx
├── app/(main)/documents/[id]/page.tsx
└── app/(main)/layout.tsx
```

---

## 7. 验证方案

### 7.1 后端验证

```bash
# 1. 全量重建索引
curl -X POST http://localhost:4000/api/v1/search/reindex
# 预期：返回索引的文档数

# 2. 搜索测试
curl "http://localhost:4000/api/v1/search?q=测试"
# 预期：返回匹配文档，含高亮结果

# 3. 带过滤搜索
curl "http://localhost:4000/api/v1/search?q=hello&folderId=xxx"
# 预期：仅返回指定文件夹内的匹配文档

# 4. 创建文档后验证索引同步
curl -X POST /api/v1/documents -d '{"title":"搜索测试","content":"这是一个测试文档"}'
sleep 1
curl "/api/v1/search?q=搜索测试"
# 预期：新创建的文档出现在搜索结果中
```

### 7.2 前端验证

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 搜索触发 | 按 Cmd+K / Ctrl+K | 搜索弹窗打开 |
| 搜索输入 | 输入关键词 | 300ms 后显示搜索结果 |
| 搜索高亮 | 查看搜索结果 | 标题和内容中的关键词被黄色高亮 |
| 搜索导航 | 键盘 ↑↓ 选择 + Enter | 跳转到对应文档 |
| 搜索页面 | 访问 /search?q=测试 | 显示完整搜索结果列表 |
| 文档预览 | 编辑页点击 [预览] | Markdown 渲染正确（标题、列表、代码块等） |
| 容错 | 停止 Meilisearch 容器 → 创建文档 | 文档创建成功，搜索不可用但不报错 |

---

## 8. 完成标准

- [ ] Meilisearch 索引配置正确（可搜索/可过滤/可排序字段）
- [ ] 文档创建/更新/删除时自动同步 Meilisearch 索引
- [ ] 全量重建索引端点可用
- [ ] 搜索 API 支持关键词搜索、文件夹过滤、标签过滤
- [ ] 搜索结果包含高亮标记
- [ ] Cmd+K 搜索弹窗正常工作
- [ ] 搜索结果页正常渲染
- [ ] Markdown 预览渲染正确（含 GFM 和代码高亮）
- [ ] Meilisearch 不可用时主流程不受影响
