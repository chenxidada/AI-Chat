# Phase 1-1b Spec: 前端文件夹树 + 文档列表 + 标签管理 UI

## 1. 目标

在 Phase 1-1a 的布局 Shell 和后端 API 之上，实现完整的前端 CRUD 管理界面。完成后：

- 用户可通过侧边栏文件夹树浏览和管理文件夹
- 用户可查看文档列表（列表/网格视图），支持分页、排序、过滤
- 用户可创建和编辑文档（使用临时 textarea，1-3 替换为 Markdown 编辑器）
- 用户可管理标签并为文档关联标签

---

## 2. 前置条件

- Phase 1-1a 全部完成
- 后端 3 组 API 可用（文件夹/文档/标签）
- 前端布局 Shell 就绪

---

## 3. Module 1: 文件夹树侧边栏

### 3.1 功能需求

- 树状展示文件夹层级，支持展开/折叠
- 点击文件夹筛选右侧文档列表（URL query: `?folder=:id`）
- 右键菜单：新建子文件夹、重命名、移动、删除
- 显示每个文件夹的文档计数
- "全部文档" 和 "未分类" 两个虚拟节点始终置顶
- 选中状态高亮

### 3.2 组件结构

```
<FolderTree>
  ├── <FolderTreeHeader>             # "文件夹" 标题 + 新建按钮
  ├── <FolderTreeItem virtual>       # "全部文档" 虚拟节点
  ├── <FolderTreeItem virtual>       # "未分类" 虚拟节点
  ├── <FolderTreeItem>               # 递归组件
  │     ├── ChevronRight/Down 图标   # 展开/折叠（有子节点时显示）
  │     ├── FolderIcon + 名称
  │     ├── 文档计数 Badge
  │     ├── <FolderTreeItem>...      # 递归子文件夹
  │     └── inline 重命名输入框      # 双击触发
  └── <FolderContextMenu>            # 右键菜单
        ├── 新建子文件夹
        ├── 重命名
        ├── 移动到...
        └── 删除
```

### 3.3 React Query Hooks

```typescript
// hooks/use-folders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: () => apiClient.get('/v1/folders').then(r => r.data),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFolderRequest) =>
      apiClient.post('/v1/folders', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}

export function useUpdateFolder() { /* ... invalidate folders */ }
export function useDeleteFolder() { /* ... invalidate folders + documents */ }
export function useReorderFolders() { /* ... invalidate folders */ }
```

### 3.4 交互细节

- **展开/折叠**: 点击 chevron 图标或双击文件夹行
- **选中筛选**: 单击文件夹名称 → 更新 URL `?folder=:id` → 文档列表刷新
- **重命名**: 双击文件夹名称 → 内联输入框 → Enter 确认 / Escape 取消
- **删除确认**: 弹出确认对话框，提示子文件夹数和文档数
- **空状态**: 无文件夹时显示引导文案

### 3.5 文件产出

| 文件 | 说明 |
|------|------|
| `apps/web/components/folders/folder-tree.tsx` | 文件夹树主组件 |
| `apps/web/components/folders/folder-tree-item.tsx` | 递归文件夹节点 |
| `apps/web/components/folders/folder-context-menu.tsx` | 右键菜单 |
| `apps/web/components/folders/create-folder-dialog.tsx` | 创建文件夹对话框 |
| `apps/web/hooks/use-folders.ts` | React Query hooks |

---

## 4. Module 2: 文档列表与操作

### 4.1 功能需求

- **列表视图**: 表格式，每行显示标题、摘要、标签、文件夹、更新时间
- **网格视图**: 卡片式，每卡片显示标题、摘要预览（3行）、标签
- 视图模式切换按钮（列表/网格）
- 排序下拉：最近更新、最近创建、标题、字数
- 分页组件
- 点击文档 → 跳转到文档编辑页 `/documents/:id`
- 工具栏：新建文档按钮、排序、视图切换
- 空状态：无文档时显示引导

### 4.2 组件结构

```
<DocumentsPage>                      # app/(main)/documents/page.tsx
  ├── <DocumentToolbar>              # 顶部工具栏
  │     ├── [+ 新建文档] 按钮
  │     ├── 排序下拉选择
  │     ├── 视图切换 (列表/网格)
  │     └── 文档计数显示
  ├── <DocumentListView>             # 列表视图（条件渲染）
  │     └── <DocumentListItem>       # 单行
  │           ├── 标题
  │           ├── 摘要（灰色，截断）
  │           ├── <TagBadge> x N
  │           ├── 文件夹名
  │           └── 更新时间（相对时间）
  ├── <DocumentGridView>             # 网格视图（条件渲染）
  │     └── <DocumentCard>           # 卡片
  │           ├── 标题
  │           ├── 摘要预览（3行）
  │           ├── <TagBadge> x N
  │           └── 更新时间
  └── <Pagination>                   # 分页
```

### 4.3 文档编辑页（临时版）

Phase 1-3 之前使用简单 textarea 作为文档编辑界面：

```
<DocumentEditPage>                   # app/(main)/documents/[id]/page.tsx
  ├── <DocumentEditHeader>
  │     ├── [← 返回] 按钮
  │     ├── 标题输入框
  │     ├── <TagSelector>
  │     └── [保存] 按钮
  └── <textarea>                     # 临时编辑器（Phase 1-3 替换为 Markdown 编辑器）
        └── 全宽全高，monospace 字体
```

新建文档页 `/documents/new` 复用相同组件，区别是调用 POST 而非 PATCH。

### 4.4 React Query Hooks

```typescript
// hooks/use-documents.ts

export function useDocuments(params: DocumentQueryParams) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => apiClient.get('/v1/documents', { params }).then(r => r.data),
    keepPreviousData: true,  // 分页切换时保持旧数据
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => apiClient.get(`/v1/documents/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateDocument() { /* ... invalidate documents */ }
export function useUpdateDocument() { /* ... invalidate documents + document detail */ }
export function useDeleteDocument() { /* ... invalidate documents */ }
export function useArchiveDocument() { /* ... invalidate documents */ }
export function useMoveDocument() { /* ... invalidate documents + folders */ }
export function useRecentDocuments() {
  return useQuery({
    queryKey: ['documents', 'recent'],
    queryFn: () => apiClient.get('/v1/documents/recent').then(r => r.data),
  });
}
```

### 4.5 URL 与状态联动

```
/documents                    → 全部文档（未归档）
/documents?folder=:id         → 指定文件夹的文档
/documents?tag=:id            → 指定标签的文档
/documents?folder=uncategorized → 未分类文档（folderId=null）
/documents?sort=updatedAt&order=desc → 排序控制
/documents?page=2             → 分页
/documents/:id                → 文档编辑
/documents/new                → 新建文档
/documents/new?folder=:id     → 在指定文件夹中新建文档
```

### 4.6 文件产出

| 文件 | 说明 |
|------|------|
| `apps/web/app/(main)/documents/page.tsx` | 文档列表页（替换占位） |
| `apps/web/app/(main)/documents/[id]/page.tsx` | 文档编辑页 |
| `apps/web/app/(main)/documents/new/page.tsx` | 新建文档页 |
| `apps/web/components/documents/document-list.tsx` | 列表视图组件 |
| `apps/web/components/documents/document-card.tsx` | 卡片视图组件 |
| `apps/web/components/documents/document-toolbar.tsx` | 工具栏 |
| `apps/web/components/ui/pagination.tsx` | 分页组件 |
| `apps/web/hooks/use-documents.ts` | React Query hooks |

---

## 5. Module 3: 标签管理

### 5.1 功能需求

- 侧边栏标签列表（文件夹树下方）
- 每个标签显示颜色圆点 + 名称 + 文档计数
- 点击标签筛选文档列表（URL: `?tag=:id`）
- "管理标签" 入口 → 弹出标签管理对话框
- 标签管理对话框：创建、编辑、删除标签，选择颜色
- 文档编辑页中的标签选择器（Combobox），支持搜索已有标签和创建新标签

### 5.2 标签列表（侧边栏）

```
<TagList>                            # 位于 sidebar 内
  ├── <TagListHeader>                # "标签" 标题 + [管理] 按钮
  ├── <TagListItem>                  # 可点击
  │     ├── 颜色圆点 (8px)
  │     ├── 标签名称
  │     └── 文档计数
  └── <ManageTagDialog>              # 管理标签对话框
        ├── 标签列表（可编辑）
        │     ├── 颜色选择器（6 个预设色）
        │     ├── 名称（可编辑）
        │     └── [删除] 按钮
        └── [+ 新建标签] 输入行
```

### 5.3 标签选择器（文档编辑页内）

```
<TagSelector>                        # 在文档编辑 Header 中
  ├── 已选标签展示（Badge 列表，可点 x 移除）
  └── <Combobox>
        ├── 搜索输入框
        ├── 匹配的已有标签
        └── "+ 创建 '输入内容'" 选项（搜索无匹配时）
```

### 5.4 颜色预设

```typescript
const TAG_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];
```

### 5.5 React Query Hooks

```typescript
// hooks/use-tags.ts

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiClient.get('/v1/tags').then(r => r.data),
  });
}

export function useCreateTag() { /* ... invalidate tags */ }
export function useUpdateTag() { /* ... invalidate tags */ }
export function useDeleteTag() { /* ... invalidate tags + documents */ }
```

### 5.6 文件产出

| 文件 | 说明 |
|------|------|
| `apps/web/components/tags/tag-list.tsx` | 侧边栏标签列表 |
| `apps/web/components/tags/tag-badge.tsx` | 标签 Badge 组件 |
| `apps/web/components/tags/tag-selector.tsx` | 文档编辑中的标签选择器 |
| `apps/web/components/tags/manage-tag-dialog.tsx` | 标签管理对话框 |
| `apps/web/hooks/use-tags.ts` | React Query hooks |

---

## 6. Sidebar 集成

更新 Phase 1-1a 的 `sidebar.tsx`，将占位内容替换为真实组件：

```tsx
// components/layout/sidebar.tsx 更新后结构
<aside>
  <div className="flex-1 overflow-y-auto">
    <FolderTree />                  {/* Module 1 */}
    <Separator />
    <TagList />                     {/* Module 3 */}
  </div>
  <div className="p-3 border-t">
    <Button onClick={createNewDocument}>+ 新文档</Button>
  </div>
</aside>
```

---

## 7. 全量文件产出清单

```
Phase 1-1b 新增/修改文件（~17 个）

新增 (15 files)
├── components/folders/
│   ├── folder-tree.tsx
│   ├── folder-tree-item.tsx
│   ├── folder-context-menu.tsx
│   └── create-folder-dialog.tsx
├── components/documents/
│   ├── document-list.tsx
│   ├── document-card.tsx
│   └── document-toolbar.tsx
├── components/tags/
│   ├── tag-list.tsx
│   ├── tag-badge.tsx
│   ├── tag-selector.tsx
│   └── manage-tag-dialog.tsx
├── components/ui/
│   └── pagination.tsx
├── hooks/
│   ├── use-folders.ts
│   ├── use-documents.ts
│   └── use-tags.ts
├── app/(main)/documents/[id]/
│   └── page.tsx
└── app/(main)/documents/new/
    └── page.tsx

修改 (2 files)
├── app/(main)/documents/page.tsx   # 替换占位为真实列表
└── components/layout/sidebar.tsx   # 替换占位为 FolderTree + TagList
```

---

## 8. 验证方案

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 文件夹树 | 访问 /documents | 侧边栏显示文件夹树，含"全部文档"和"未分类" |
| 创建文件夹 | 点击 + 按钮 → 输入名称 → 确认 | 文件夹出现在树中 |
| 重命名 | 右键 → 重命名 → 修改 → Enter | 文件夹名更新 |
| 删除文件夹 | 右键 → 删除 → 确认 | 文件夹消失，其下文档移至未分类 |
| 文件夹筛选 | 点击文件夹 | 右侧列表仅显示该文件夹下的文档 |
| 文档列表 | 访问 /documents | 显示文档列表/卡片，含标题、摘要、标签、时间 |
| 视图切换 | 点击列表/网格按钮 | 视图正确切换 |
| 排序 | 选择"按标题" | 列表按标题排序 |
| 分页 | 文档 > 20 条时点击下一页 | 正确翻页 |
| 新建文档 | 点击 "+ 新文档" → 输入标题和内容 → 保存 | 文档创建成功，列表中出现 |
| 编辑文档 | 点击文档 → 修改内容 → 保存 | 更新成功 |
| 标签列表 | 侧边栏 | 显示标签列表，含颜色和文档计数 |
| 创建标签 | 标签管理 → 输入名称 → 选色 → 确认 | 标签创建成功 |
| 标签筛选 | 点击标签 | 右侧列表仅显示含该标签的文档 |
| 文档关联标签 | 编辑页 → 标签选择器 → 选择/创建标签 → 保存 | 文档标签关联正确 |

---

## 9. 完成标准

- [ ] 文件夹树正确渲染，支持展开/折叠、创建、重命名、删除
- [ ] 文件夹点击正确筛选文档列表
- [ ] 文档列表支持列表/网格视图切换
- [ ] 文档列表支持排序和分页
- [ ] 文档创建和编辑功能可用（textarea 临时编辑器）
- [ ] 标签列表显示在侧边栏，点击可筛选文档
- [ ] 标签管理对话框可创建、编辑、删除标签
- [ ] 文档编辑页标签选择器正常工作
- [ ] 所有 UI 操作通过 React Query 与后端 API 正确交互
