# Phase 1-3b Spec: 数学公式 + 增强表格编辑

## 1. 目标

在 Phase 1-3a 的 CodeMirror 编辑器基础上，增加：

1. **数学公式支持**：LaTeX 行内/块级公式编辑 + KaTeX 实时预览
2. **数学公式插入对话框**：常用模板选择 + LaTeX 输入 + 实时渲染预览
3. **WYSIWYG 表格编辑**：预览区可视化表格编辑（增删行列、Tab 导航、对齐控制）
4. **表格解析器**：Markdown 表格 <-> 数据结构双向转换

---

## 2. 前置条件

- Phase 1-3a 全部完成（CodeMirror 编辑器可用，EditorToolbar 有 `onMathInsert` 回调预留）

---

## 3. 新增依赖

```bash
# apps/web
pnpm --filter @kb/web add katex remark-math rehype-katex
```

---

## 4. 模块设计

### 4.1 数学公式预览渲染

**修改文件**: `apps/web/components/documents/markdown-preview.tsx`

在 ReactMarkdown 中添加数学公式支持：

```typescript
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeHighlight, rehypeKatex]}
>
  {content}
</ReactMarkdown>
```

**支持语法**：

| 语法 | 用途 | 示例 |
|------|------|------|
| `$...$` | 行内公式 | `$E=mc^2$` → 𝐸=𝑚𝑐² |
| `$$...$$` | 块级公式（居中显示） | `$$\sum_{i=1}^n x_i$$` |

### 4.2 数学公式插入对话框

**新增文件**: `apps/web/components/editor/math-insert-dialog.tsx`

```typescript
interface MathInsertDialogProps {
  open: boolean;
  onClose: () => void;
  editorRef: React.RefObject<EditorHandle | null>;
}
```

**布局结构**：

```
┌─ 插入数学公式 ──────────────────────────────────── [X] ─┐
│                                                          │
│  ┌── 常用模板 ─┐  ┌── LaTeX 公式 ──────────────────┐    │
│  │  分式       │  │                                  │    │
│  │  求和       │  │  <textarea> LaTeX 输入            │    │
│  │  积分       │  │                                  │    │
│  │  极限       │  ├── 预览 ────────────────────────┤    │
│  │  平方根     │  │                                  │    │
│  │  上下标     │  │  [KaTeX 实时渲染]                 │    │
│  │  矩阵       │  │                                  │    │
│  │  希腊字母   │  ├───────────────────────────────┤    │
│  │  不等式     │  │  ☐ 块级公式           [插入]     │    │
│  │  对数       │  │                                  │    │
│  └─────────────┘  └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**预定义模板（10 个）**：

| 模板 | LaTeX |
|------|-------|
| 分式 | `\frac{a}{b}` |
| 求和 | `\sum_{i=1}^{n} x_i` |
| 积分 | `\int_{a}^{b} f(x) \, dx` |
| 极限 | `\lim_{x \to \infty} f(x)` |
| 平方根 | `\sqrt{x}` |
| 上下标 | `x^{2} + y_{1}` |
| 矩阵 | `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` |
| 希腊字母 | `\alpha, \beta, \gamma, \theta, \pi` |
| 不等式 | `a \leq b \leq c` |
| 对数 | `\log_{2}(x)` |

**实时预览**：使用 `katex.renderToString()` 动态导入（避免 SSR 问题），错误时显示红色提示。

**插入行为**：
- 行内模式：`$latex$`
- 块级模式（勾选复选框）：`$$\nlatex\n$$`
- 通过 `insertTemplate(view, text)` 插入到编辑器

### 4.3 WYSIWYG 表格编辑

#### 4.3.1 表格解析器

**新增文件**: `apps/web/components/editor/table-editor/table-parser.ts`

```typescript
export interface TableData {
  headers: string[];
  rows: string[][];
  aligns: ('left' | 'center' | 'right' | 'none')[];
}

// parseMarkdownTable(text: string): TableData | null
//   - 按行分割，检查所有行以 | 开头
//   - 第一行 → headers
//   - 第二行 → aligns（解析 :---/:---:/---: 符号）
//   - 后续行 → rows（补齐或截断到 headers 长度）

// generateMarkdownTable(data: TableData): string
//   - 自动计算每列最大宽度对齐（提升可读性）
//   - 支持 left/center/right/none 对齐符号生成
//   - 最小列宽 3（for `---`）

// createEmptyTable(rowCount: number, colCount: number): string
//   - 生成指定尺寸的空白表格（表头: 列1/列2/...）
```

**数据流**：

```
Markdown 源码
    │ parseMarkdownTable()
    ▼
TableData { headers[], rows[][], aligns[] }
    │ <TableEditor> 可视化编辑
    │ onTableChange(TableData)
    ▼ generateMarkdownTable(TableData)
Markdown 源码
```

#### 4.3.2 表格编辑器组件

**新增文件**: `apps/web/components/editor/table-editor/index.tsx`

```typescript
interface TableEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
}
```

**功能**：

- 渲染为 HTML `<table>`，每个单元格使用 `<TableCell>` 可编辑组件
- 解析失败时 fallback 到 `<pre>` 显示原始文本
- Tab: 下一格，Shift+Tab: 上一格
- 最后一格 Tab: 自动创建新行
- Enter: 跳到下一行同列
- 右键菜单：增删行列、设置对齐
- readOnly 模式：单元格显示纯文本
- 表头行背景高亮 (`bg-gray-50`)

#### 4.3.3 可编辑单元格

**新增文件**: `apps/web/components/editor/table-editor/table-cell.tsx`

```typescript
interface TableCellProps {
  value: string;
  onChange: (value: string) => void;
  isHeader?: boolean;
  onTab?: (shift: boolean) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}
```

- 使用 `<input>` 实现单元格编辑
- 拦截 Tab/Enter 键事件，触发导航回调
- `autoFocus` 通过 `useEffect` + ref 实现焦点管理
- 表头单元格使用 `font-semibold`

#### 4.3.4 表格右键菜单

**新增文件**: `apps/web/components/editor/table-editor/table-context-menu.tsx`

```typescript
interface TableContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  // 行操作
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  // 列操作
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  // 删除
  onDeleteRow: () => void;    // canDeleteRow: 至少保留 1 行
  onDeleteCol: () => void;    // canDeleteCol: 至少保留 1 列
  // 对齐
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
}
```

**菜单项**：
1. 在上方插入行
2. 在下方插入行
3. ---
4. 在左侧插入列
5. 在右侧插入列
6. ---
7. 删除当前行（最后 1 行时禁用）
8. 删除当前列（最后 1 列时禁用）
9. ---
10. 左对齐
11. 居中对齐
12. 右对齐

- 点击外部区域或 Escape 关闭
- 固定定位 (`position: fixed`)，跟随鼠标位置

### 4.4 工具栏集成

**修改文件**: `apps/web/components/editor/editor-toolbar.tsx`

- 数学公式按钮（∑ 图标）→ 触发 `onMathInsert` 回调 → 打开 MathInsertDialog
- 表格按钮已有 6x6 网格选择器（1-3a 已实现）→ 使用 `createEmptyTable()` 生成

### 4.5 页面集成

**修改文件**: `apps/web/app/(main)/documents/[id]/page.tsx` 和 `new/page.tsx`

- 新增 `mathDialogOpen` 状态
- `MathInsertDialog` 组件挂载在页面底部
- `EditorToolbar` 传入 `onMathInsert={() => setMathDialogOpen(true)}`

---

## 5. 文件清单

```
新增 (5 files)
├── apps/web/components/editor/
│   ├── math-insert-dialog.tsx          # 数学公式插入对话框
│   └── table-editor/
│       ├── index.tsx                   # WYSIWYG 表格编辑器
│       ├── table-parser.ts            # Markdown 表格双向转换
│       ├── table-cell.tsx             # 可编辑单元格
│       └── table-context-menu.tsx     # 右键菜单

修改 (3 files)
├── apps/web/components/documents/markdown-preview.tsx  # +remarkMath +rehypeKatex
├── apps/web/components/editor/editor-toolbar.tsx       # +数学按钮回调 (已预留)
├── apps/web/app/(main)/documents/[id]/page.tsx         # +MathInsertDialog 集成
└── apps/web/app/(main)/documents/new/page.tsx          # +MathInsertDialog 集成
```

---

## 6. 验证方案

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 行内公式 | 输入 `$E=mc^2$` | 预览渲染 KaTeX 公式 |
| 块级公式 | 输入 `$$\sum_{i=1}^n$$` | 预览居中渲染公式块 |
| 公式对话框 | 点击 ∑ 按钮 | 弹窗展示 10 个模板 + 实时预览 |
| 模板选择 | 点击"分式"模板 | LaTeX 输入框填入 `\frac{a}{b}`，预览渲染分式 |
| 块级切换 | 勾选"块级公式" | 预览切换为 displayMode |
| 公式错误 | 输入无效 LaTeX | 预览显示红色错误提示 |
| 表格解析 | 输入 GFM 表格 | parseMarkdownTable 返回正确 TableData |
| 表格生成 | generateMarkdownTable | 输出对齐的 Markdown 表格 |
| 单元格编辑 | 点击单元格修改 | 输入变化通过 onChange 回传 |
| Tab 导航 | 表格中按 Tab | 光标跳到下一格 |
| Shift+Tab | 表格中按 Shift+Tab | 光标跳到上一格 |
| 最后格 Tab | 最后单元格按 Tab | 自动创建新行 |
| 右键菜单 | 右键点击单元格 | 弹出操作菜单 |
| 插入行 | 右键 → 在下方插入行 | 新空行出现 |
| 插入列 | 右键 → 在右侧插入列 | 新空列出现 |
| 删除行 | 右键 → 删除当前行 | 行被移除 |
| 删除列 | 右键 → 删除当前列 | 列被移除 |
| 对齐 | 右键 → 居中对齐 | 对齐符号变为 `:---:` |
| 最后行/列保护 | 只剩 1 行/列时 | 删除按钮禁用 |
| 序列化 | parse → edit → generate | 内容语义等价 |
| 构建 | `pnpm --filter @kb/web build` | 通过 |

---

## 7. 完成标准

- [x] `$...$` 行内公式和 `$$...$$` 块级公式在预览中正确渲染
- [x] 数学公式插入对话框：10 个常用模板 + 实时 KaTeX 预览
- [x] 行内/块级公式切换
- [x] Markdown 表格双向解析（parse/generate）
- [x] 表格编辑器可视化编辑单元格
- [x] Tab/Shift+Tab/Enter 键盘导航
- [x] 右键菜单增删行列 + 对齐控制
- [x] 插入表格通过 6x6 网格选择器
- [x] readOnly 模式支持
- [x] 前端构建通过
