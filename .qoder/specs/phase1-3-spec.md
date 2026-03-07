# Phase 1-3 Spec: Markdown 编辑器

## 1. 目标

将 Phase 1-1b 中的临时 textarea 替换为完整的 Markdown 分屏编辑器，提供专业的文档创作体验。完成后：

- 用户可在 CodeMirror 编辑器中编写 Markdown，右侧实时预览渲染结果
- 支持编辑/预览/分屏三种模式切换
- 编辑器工具栏提供常用 Markdown 格式快捷插入
- 自动保存（防抖 2 秒），避免内容丢失
- 快捷键支持常用操作

---

## 2. 前置条件

- Phase 1-1b 全部完成（文档编辑页已有 textarea 临时编辑器）
- Phase 1-2 的 `MarkdownPreview` 组件已可用（将在分屏模式复用）

> 注：1-2 和 1-3 互不依赖，可并行开发。如果 1-3 先于 1-2 实施，需自行创建 MarkdownPreview 组件。

---

## 3. 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 源码编辑器 | CodeMirror 6 | 轻量、高性能、插件化 |
| Markdown 语法 | @codemirror/lang-markdown | CM6 官方 Markdown 语言包 |
| 预览渲染 | react-markdown + remark-gfm | 复用 Phase 1-2 的 MarkdownPreview |
| 代码高亮 | rehype-highlight | 预览中代码块语法高亮 |

选择 CodeMirror 6 而非 WYSIWYG 编辑器的理由：
- Markdown 源码编辑更适合技术知识库场景
- 分屏预览提供所见即所得体验的同时保留源码控制力
- CodeMirror 6 性能优异，大文档编辑流畅
- 插件体系成熟，可扩展性强

---

## 4. 编辑器页面布局

### 4.1 完整布局

```
┌──────────────────────────────────────────────────────────┐
│ [← 返回]  │  标题输入框(可编辑)  │  <TagSelector>  │ 状态 │
├──────────────────────────────────────────────────────────┤
│ [工具栏: H1 H2 H3 | B I S | UL OL | Link Img Code | ⋮] │
├────────────────────────────┬─────────────────────────────┤
│                            │                             │
│   CodeMirror 编辑区域      │   Markdown 预览区域          │
│   (monospace 字体)         │   (prose 样式)              │
│                            │                             │
│   # Hello World            │   Hello World               │
│                            │   ═══════════               │
│   This is **bold** and     │   This is bold and          │
│   *italic* text.           │   italic text.              │
│                            │                             │
│   ```typescript            │   ┌─────────────────┐       │
│   const x = 1;             │   │ const x = 1;    │       │
│   ```                      │   └─────────────────┘       │
│                            │                             │
├────────────────────────────┴─────────────────────────────┤
│ 字数: 128 字 │ 自动保存: 已保存 │ Ln 12, Col 8 │ [E|P|S] │
└──────────────────────────────────────────────────────────┘

E = 编辑模式（仅编辑器全宽）
P = 预览模式（仅预览全宽）
S = 分屏模式（左编辑 + 右预览）← 默认
```

### 4.2 响应式适配

- 宽屏（>= 1024px）：默认分屏模式
- 窄屏（< 1024px）：默认编辑模式，通过切换查看预览
- 工具栏在窄屏时折叠为更多菜单

---

## 5. Module 1: CodeMirror 编辑器组件

### 5.1 编辑器核心

```typescript
// components/editor/markdown-editor.tsx

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';  // 暗色主题可选

interface MarkdownEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  className?: string;
}

export function MarkdownEditor({ initialContent, onChange, className }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown({ base: markdownLanguage }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'monospace' },
          '.cm-content': { padding: '16px' },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => view.destroy();
  }, []);  // 仅初始化一次

  return <div ref={containerRef} className={className} />;
}
```

### 5.2 工具栏命令

```typescript
// components/editor/editor-toolbar.tsx

interface ToolbarAction {
  icon: string;        // 图标名或 emoji
  label: string;       // tooltip 文本
  shortcut?: string;   // 快捷键显示
  action: (view: EditorView) => void;
}

const toolbarActions: ToolbarAction[] = [
  // 标题
  { icon: 'H1', label: '一级标题', shortcut: 'Ctrl+1',
    action: (view) => wrapLine(view, '# ') },
  { icon: 'H2', label: '二级标题', shortcut: 'Ctrl+2',
    action: (view) => wrapLine(view, '## ') },
  { icon: 'H3', label: '三级标题', shortcut: 'Ctrl+3',
    action: (view) => wrapLine(view, '### ') },

  // 分隔
  { type: 'separator' },

  // 文本格式
  { icon: 'B', label: '粗体', shortcut: 'Ctrl+B',
    action: (view) => wrapSelection(view, '**', '**') },
  { icon: 'I', label: '斜体', shortcut: 'Ctrl+I',
    action: (view) => wrapSelection(view, '*', '*') },
  { icon: 'S', label: '删除线',
    action: (view) => wrapSelection(view, '~~', '~~') },
  { icon: '`', label: '行内代码',
    action: (view) => wrapSelection(view, '`', '`') },

  // 分隔
  { type: 'separator' },

  // 列表
  { icon: 'UL', label: '无序列表',
    action: (view) => wrapLine(view, '- ') },
  { icon: 'OL', label: '有序列表',
    action: (view) => wrapLine(view, '1. ') },
  { icon: '☑', label: '任务列表',
    action: (view) => wrapLine(view, '- [ ] ') },

  // 分隔
  { type: 'separator' },

  // 插入
  { icon: '🔗', label: '链接', shortcut: 'Ctrl+K',
    action: (view) => insertTemplate(view, '[链接文字](url)') },
  { icon: '🖼', label: '图片',
    action: (view) => insertTemplate(view, '![描述](url)') },
  { icon: '< >', label: '代码块',
    action: (view) => insertTemplate(view, '```\n代码\n```') },
  { icon: '—', label: '分隔线',
    action: (view) => insertTemplate(view, '\n---\n') },
  { icon: '||', label: '表格',
    action: (view) => insertTemplate(view, TABLE_TEMPLATE) },
  { icon: '> ', label: '引用块',
    action: (view) => wrapLine(view, '> ') },
];

const TABLE_TEMPLATE = `| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |`;
```

### 5.3 工具栏辅助函数

```typescript
// 在光标位置或选区两端包裹文本
function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to) || '文本';
  view.dispatch({
    changes: { from, to, insert: before + selected + after },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
  view.focus();
}

// 在行首添加前缀
function wrapLine(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  view.focus();
}

// 在光标位置插入模板
function insertTemplate(view: EditorView, template: string) {
  const { from } = view.state.selection.main;
  view.dispatch({
    changes: { from, insert: template },
    selection: { anchor: from + template.length },
  });
  view.focus();
}
```

---

## 6. Module 2: 自动保存

### 6.1 自动保存 Hook

```typescript
// hooks/use-auto-save.ts

import { useRef, useEffect, useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface UseAutoSaveOptions {
  documentId: string;
  delay?: number;           // 防抖延迟，默认 2000ms
  onSave: (content: string) => Promise<void>;
}

interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  error: string | null;
}

export function useAutoSave({ documentId, delay = 2000, onSave }: UseAutoSaveOptions) {
  const [autoSaveStatus, setStatus] = useState<AutoSaveStatus>({
    status: 'idle',
    lastSavedAt: null,
    error: null,
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');

  const save = useCallback(async (content: string) => {
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;

    setStatus(s => ({ ...s, status: 'saving' }));
    try {
      await onSave(content);
      setStatus({ status: 'saved', lastSavedAt: new Date(), error: null });
    } catch (err) {
      setStatus(s => ({ ...s, status: 'error', error: '保存失败' }));
    }
  }, [onSave]);

  const scheduleAutoSave = useCallback((content: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus(s => ({ ...s, status: 'idle' }));
    timerRef.current = setTimeout(() => save(content), delay);
  }, [save, delay]);

  // Ctrl+S 手动保存
  const manualSave = useCallback((content: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    save(content);
  }, [save]);

  // 组件卸载时保存未保存内容
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { autoSaveStatus, scheduleAutoSave, manualSave };
}
```

### 6.2 Ctrl+S 快捷键

在编辑器页面中监听 Ctrl+S / Cmd+S：

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      manualSave(currentContent);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [manualSave, currentContent]);
```

---

## 7. Module 3: 编辑器状态栏

### 7.1 状态栏布局

```
┌────────────────────────────────────────────────────────┐
│  字数: 1,234 字  │  自动保存: 已保存 (10:32)  │  Ln 42, Col 8  │  [E] [P] [S]  │
└────────────────────────────────────────────────────────┘
```

### 7.2 组件实现

```typescript
// components/editor/editor-statusbar.tsx

interface EditorStatusBarProps {
  wordCount: number;
  autoSaveStatus: AutoSaveStatus;
  cursorPosition: { line: number; col: number };
  viewMode: 'edit' | 'preview' | 'split';
  onViewModeChange: (mode: 'edit' | 'preview' | 'split') => void;
}

export function EditorStatusBar({
  wordCount, autoSaveStatus, cursorPosition, viewMode, onViewModeChange,
}: EditorStatusBarProps) {
  const saveText = {
    idle: '未保存更改',
    saving: '保存中...',
    saved: `已保存 (${formatTime(autoSaveStatus.lastSavedAt)})`,
    error: '保存失败',
  }[autoSaveStatus.status];

  return (
    <div className="flex items-center justify-between px-4 py-1 border-t text-xs text-gray-500">
      <div className="flex items-center gap-4">
        <span>{wordCount.toLocaleString()} 字</span>
        <span className={autoSaveStatus.status === 'error' ? 'text-red-500' : ''}>
          {saveText}
        </span>
        <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
      </div>
      <div className="flex items-center gap-1">
        {(['edit', 'preview', 'split'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              'px-2 py-0.5 rounded text-xs',
              viewMode === mode ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100',
            )}
          >
            {{ edit: '编辑', preview: '预览', split: '分屏' }[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Module 4: 编辑页重构

### 8.1 替换临时 textarea

将 `app/(main)/documents/[id]/page.tsx` 和 `app/(main)/documents/new/page.tsx` 中的 textarea 替换为完整编辑器组件：

```typescript
// app/(main)/documents/[id]/page.tsx 核心结构

'use client';

export default function DocumentEditPage({ params }: { params: { id: string } }) {
  const { data: document } = useDocument(params.id);
  const updateDoc = useUpdateDocument();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const { autoSaveStatus, scheduleAutoSave, manualSave } = useAutoSave({
    documentId: params.id,
    onSave: async (content) => {
      await updateDoc.mutateAsync({ id: params.id, content, title });
    },
  });

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    scheduleAutoSave(newContent);
  }, [scheduleAutoSave]);

  const wordCount = useMemo(() => countWords(content), [content]);

  return (
    <div className="flex flex-col h-full">
      {/* Header: 返回按钮 + 标题 + 标签 + 保存按钮 */}
      <DocumentEditHeader
        title={title}
        onTitleChange={setTitle}
        documentId={params.id}
        onManualSave={() => manualSave(content)}
      />

      {/* 工具栏（编辑/分屏模式显示） */}
      {viewMode !== 'preview' && (
        <EditorToolbar editorView={editorViewRef.current} />
      )}

      {/* 编辑器 + 预览 */}
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'w-1/2 border-r' : 'w-full'}>
            <MarkdownEditor
              initialContent={document?.content || ''}
              onChange={handleContentChange}
              onCursorChange={setCursorPos}
              className="h-full"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'w-1/2' : 'w-full'}>
            <div className="h-full overflow-auto p-6">
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <EditorStatusBar
        wordCount={wordCount}
        autoSaveStatus={autoSaveStatus}
        cursorPosition={cursorPos}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}
```

---

## 9. 快捷键汇总

| 快捷键 | 操作 |
|--------|------|
| `Ctrl/Cmd + S` | 手动保存 |
| `Ctrl/Cmd + B` | 粗体 |
| `Ctrl/Cmd + I` | 斜体 |
| `Ctrl/Cmd + 1/2/3` | 一/二/三级标题 |
| `Ctrl/Cmd + K` | 插入链接 |
| `Ctrl/Cmd + Z` | 撤销（CodeMirror 内置） |
| `Ctrl/Cmd + Shift + Z` | 重做（CodeMirror 内置） |

---

## 10. 新增依赖

```bash
pnpm --filter @kb/web add codemirror @codemirror/view @codemirror/state @codemirror/lang-markdown @codemirror/commands @codemirror/theme-one-dark
```

> `react-markdown`、`remark-gfm`、`rehype-highlight` 已在 Phase 1-2 安装。如 1-3 先于 1-2 实施，需一并安装。

---

## 11. 全量文件产出清单

```
Phase 1-3 新增/修改文件（~8 个）

新增 (5 files)
├── components/editor/
│   ├── markdown-editor.tsx          # CodeMirror 编辑器
│   ├── editor-toolbar.tsx           # 工具栏
│   └── editor-statusbar.tsx         # 状态栏
├── hooks/
│   └── use-auto-save.ts             # 自动保存 Hook
└── components/documents/
    └── document-edit-header.tsx      # 编辑页顶部栏（标题+标签+保存）

修改 (3 files)
├── app/(main)/documents/[id]/page.tsx   # textarea → MarkdownEditor
├── app/(main)/documents/new/page.tsx    # textarea → MarkdownEditor
└── components/documents/markdown-preview.tsx  # 如 1-3 先于 1-2，此文件为新增
```

---

## 12. 验证方案

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 编辑器加载 | 打开已有文档 | CodeMirror 编辑器显示文档内容，行号可见 |
| Markdown 语法 | 输入 `# 标题`、`**粗体**` | 编辑器有语法高亮 |
| 实时预览 | 分屏模式下编辑 | 右侧预览实时跟随更新 |
| 工具栏 | 选中文字 → 点击 B | 选中文字被 `**` 包裹 |
| 工具栏 | 点击代码块按钮 | 插入代码块模板 |
| 自动保存 | 编辑内容后等待 2 秒 | 状态栏显示"已保存" |
| 手动保存 | Ctrl+S | 立即保存，状态栏更新 |
| 视图切换 | 点击 [编辑] [预览] [分屏] | 正确切换布局 |
| 字数统计 | 编辑内容 | 状态栏字数实时更新 |
| 光标位置 | 移动光标 | 状态栏显示 Ln/Col |
| 中文输入 | 使用输入法 | 输入过程流畅，无异常触发 |
| 新建文档 | 访问 /documents/new | 空编辑器，保存后跳转到文档详情 |
| 大文档 | 粘贴 10000+ 字内容 | 编辑和预览无明显卡顿 |

---

## 13. 完成标准

- [ ] CodeMirror 编辑器正确初始化，支持 Markdown 语法高亮
- [ ] 分屏模式左编辑右预览，实时同步
- [ ] 编辑/预览/分屏三种模式可切换
- [ ] 工具栏所有按钮功能正常（标题、粗体、斜体、列表、链接、图片、代码块、表格、引用）
- [ ] 自动保存生效（防抖 2 秒），状态栏正确显示保存状态
- [ ] Ctrl+S 手动保存可用
- [ ] 字数统计和光标位置实时显示
- [ ] 中文输入法兼容
- [ ] 新建文档和编辑文档均使用新编辑器
- [ ] textarea 临时编辑器完全移除
