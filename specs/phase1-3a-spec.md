# Phase 1-3a Spec: 核心 CodeMirror 编辑器 + 高级编辑

## 1. 目标

将 Phase 1-1b 的临时 textarea 替换为基于 CodeMirror 6 的专业 Markdown 编辑器，实现：

- 源码编辑 + 分屏预览
- 格式化工具栏（标题、粗体、斜体、列表、链接、代码块等）
- 自动保存（防抖 2s）+ Ctrl+S 手动保存
- 快捷键系统 + Ctrl+/ 参考面板
- Ctrl+F 查找 / Ctrl+H 替换（支持正则）
- 多光标编辑、矩形选择
- 底部状态栏（字数、保存状态、光标位置、视图模式）

---

## 2. 前置条件

- Phase 1-1b 全部完成（文档编辑页已有 textarea 临时编辑器）
- Phase 1-2 的 `MarkdownPreview` 组件已可用

---

## 3. 新增依赖

```bash
# apps/web
pnpm --filter @kb/web add \
  @codemirror/view @codemirror/state @codemirror/commands \
  @codemirror/lang-markdown @codemirror/language @codemirror/language-data \
  @codemirror/search @codemirror/autocomplete
```

---

## 4. 编辑器页面布局

### 4.1 完整布局

```
┌──────────────────────────────────────────────────────────────────┐
│ [← 返回]  文件夹/编辑 │  标题输入框  │  <TagSelector>  │  保存状态  │
├──────────────────────────────────────────────────────────────────┤
│ [H1 H2 H3 | B I ~~ ` | UL OL ☑ | Link Img Code — || > | ∑ | ?]│
├───────────────────────────────┬──────────────────────────────────┤
│                               │                                  │
│   CodeMirror 编辑区域          │   Markdown 预览区域               │
│   (monospace, 行号, 语法高亮)   │   (prose 样式)                   │
│                               │                                  │
├───────────────────────────────┴──────────────────────────────────┤
│ 字数: 1,234 字 │ 已保存 (10:32) │ Ln 42, Col 8 │ [编辑|预览|分屏] │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 视图模式

| 模式 | 布局 |
|------|------|
| 编辑 | 仅 CodeMirror 全宽 |
| 预览 | 仅 MarkdownPreview 全宽 |
| 分屏 | 左编辑 + 右预览（默认） |

### 4.3 响应式适配

- 宽屏（>= 1024px）：默认分屏模式
- 窄屏（< 1024px）：默认编辑模式
- 工具栏在窄屏时可水平滚动

---

## 5. 模块设计

### 5.1 CodeMirror 编辑器组件

**文件**: `apps/web/components/editor/codemirror-editor.tsx`

```typescript
export interface EditorHandle {
  getView(): EditorView | null;
  focus(): void;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
  placeholder?: string;
  className?: string;
}
```

**核心实现**：

- 使用 `forwardRef` + `useImperativeHandle` 暴露 `EditorHandle` 给父组件
- Extension 配置栈：
  1. `lineNumbers()` + `highlightActiveLineGutter()`
  2. `history()` (撤销/重做)
  3. `foldGutter()` (代码折叠)
  4. `drawSelection()` + `rectangularSelection()` (矩形选择)
  5. `crosshairCursor()` (Alt+Click 多光标)
  6. `markdown({ base: markdownLanguage, codeLanguages: languages })` (GFM 语法高亮)
  7. `search({ top: true })` (内置查找替换面板)
  8. `autocompletion()`
  9. 自定义 keymap (Mod-s/b/i/1/2/3/k 等快捷键)
  10. 自定义主题 (monospace 字体, Tailwind 风格配色)
  11. `EditorView.updateListener` (内容变化 → onChange, 光标变化 → onCursorChange)
  12. `EditorView.lineWrapping` (自动换行)
- 受控更新策略：
  - 仅在外部 value 变化（如文档从服务端加载）时整体替换内容
  - 使用 `isExternalUpdate` ref 标志防止循环更新
  - 比较 `lastValueRef` 防止光标跳动

**自定义主题**：

```typescript
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace",
    lineHeight: '1.6',
  },
  '.cm-gutters': { backgroundColor: '#fafafa', borderRight: '1px solid #e5e7eb', color: '#9ca3af' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#3b82f6' },
  '.cm-selectionBackground': { backgroundColor: '#dbeafe !important' },
  '.cm-searchMatch': { backgroundColor: '#fef08a' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#fbbf24' },
  // ... 其余面板/按钮样式
});
```

### 5.2 编辑器命令函数库

**文件**: `apps/web/components/editor/editor-commands.ts`

| 函数 | 功能 |
|------|------|
| `wrapSelection(view, before, after)` | 选中文本前后包裹标记；有选区时包裹，无选区时插入占位符；支持 Toggle（已有标记则脱去） |
| `wrapLine(view, prefix)` | 行首添加前缀；标题支持级别切换（同级 Toggle，不同级替换） |
| `insertTemplate(view, template)` | 在光标处插入模板文本 |
| `insertCodeBlock(view)` | 插入代码块（有选区则包裹选中文本） |
| `insertLink(view)` | 插入链接模板（有选区则用选区文字作为链接文本） |
| `insertImage(view)` | 插入图片模板 `![描述](url)` |

**预定义常量**：
- `TABLE_TEMPLATE`: 3x1 默认表格
- `CODE_BLOCK_TEMPLATE`: 空代码块

### 5.3 工具栏

**文件**: `apps/web/components/editor/editor-toolbar.tsx`

```typescript
interface EditorToolbarProps {
  editorRef: React.RefObject<EditorHandle | null>;
  onMathInsert?: () => void;   // 1-3b 数学公式回调
  onImageInsert?: () => void;  // 1-3c 图片插入回调
}
```

**按钮分组**：

| 组 | 按钮 | 快捷键 |
|----|------|--------|
| 标题 | H1, H2, H3 | Ctrl+1/2/3 |
| 文本格式 | 粗体, 斜体, 删除线, 行内代码 | Ctrl+B/I/Shift+S/E |
| 列表 | 无序列表, 有序列表, 任务列表 | - |
| 插入 | 链接, 代码块, 引用, 分隔线 | Ctrl+K, Ctrl+Shift+C |
| 表格 | 表格（带尺寸选择下拉） | - |
| 扩展 | 数学公式, 图片 | 通过回调触发 |

**表格选择器**：6x6 网格，鼠标悬停高亮选择行列数，点击生成对应尺寸的空白 Markdown 表格。

### 5.4 自动保存 Hook

**文件**: `apps/web/hooks/use-auto-save.ts`

```typescript
export interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  error: string | null;
}

interface UseAutoSaveOptions {
  delay?: number;    // 防抖延迟，默认 2000ms
  onSave: () => Promise<void>;
}

// 返回：
// - saveStatus: AutoSaveStatus
// - scheduleAutoSave(): 安排延迟保存（文档变更时调用）
// - manualSave(): 立即保存（取消待执行的自动保存）
```

**辅助函数**：
- `formatSaveStatus(status)`: 状态文本格式化（"未保存更改"/"保存中..."/"已保存 (HH:mm)"/"保存失败"）

### 5.5 状态栏

**文件**: `apps/web/components/editor/editor-status-bar.tsx`

```typescript
interface EditorStatusBarProps {
  wordCount: number;
  saveStatus: AutoSaveStatus;
  cursorLine: number;
  cursorCol: number;
  viewMode: 'edit' | 'preview' | 'split';
  onViewModeChange: (mode: 'edit' | 'preview' | 'split') => void;
}
```

**布局**：`[字数: N 字] | [保存状态 (时间)] | [Ln N, Col N]` ... `[编辑] [预览] [分屏]`

- 保存错误时文字变红，保存中变蓝
- 当前视图模式按钮高亮

### 5.6 快捷键系统

**文件**: `apps/web/lib/editor-keybindings.ts`

```typescript
export interface KeyBindingDef {
  id: string;
  key: string;       // Windows/Linux key
  macKey: string;     // Mac key
  description: string;
  group: string;
}

export const KEYBINDING_GROUPS = {
  basic: '基础操作',
  format: '格式化',
  search: '查找替换',
  multicursor: '多光标',
  view: '视图',
};
```

**已注册快捷键（20 个）**：

| 分组 | ID | Windows/Linux | Mac | 说明 |
|------|----|---------------|-----|------|
| 基础 | save | Ctrl-s | Cmd-s | 保存文档 |
| 基础 | undo | Ctrl-z | Cmd-z | 撤销 |
| 基础 | redo | Ctrl-Shift-z | Cmd-Shift-z | 重做 |
| 基础 | selectAll | Ctrl-a | Cmd-a | 全选 |
| 格式 | bold | Ctrl-b | Cmd-b | 粗体 |
| 格式 | italic | Ctrl-i | Cmd-i | 斜体 |
| 格式 | strikethrough | Ctrl-Shift-s | Cmd-Shift-s | 删除线 |
| 格式 | inlineCode | Ctrl-e | Cmd-e | 行内代码 |
| 格式 | heading1/2/3 | Ctrl-1/2/3 | Cmd-1/2/3 | 标题级别 |
| 格式 | link | Ctrl-k | Cmd-k | 插入链接 |
| 搜索 | find | Ctrl-f | Cmd-f | 查找 |
| 搜索 | replace | Ctrl-h | Cmd-h | 查找替换 |
| 搜索 | findNext/Prev | Ctrl-g / Ctrl-Shift-g | Cmd-g / Cmd-Shift-g | 下一个/上一个 |
| 多光标 | selectNext | Ctrl-d | Cmd-d | 选中下一个相同词 |
| 多光标 | addCursor | Alt-Click | Alt-Click | 添加光标 |
| 多光标 | rectSelect | Alt-Shift-拖动 | Alt-Shift-拖动 | 矩形选择 |
| 视图 | shortcuts | Ctrl-/ | Cmd-/ | 快捷键参考 |

**辅助函数**：
- `getKeybindingsForDisplay()`: 根据平台（Mac/Windows）返回对应快捷键
- `formatKeyDisplay(key)`: 格式化显示（Ctrl→⌃, Cmd→⌘, Alt→⌥, Shift→⇧）

### 5.7 快捷键参考面板

**文件**: `apps/web/components/editor/shortcut-panel.tsx`

- 模态对话框 (`max-w-lg`, `max-h-[80vh]`)
- 触发方式：Ctrl+/ 或工具栏 ? 按钮
- 按 `KEYBINDING_GROUPS` 分组展示快捷键
- Escape 关闭
- 自动检测平台显示对应快捷键

### 5.8 文档编辑页重构

**修改文件**: `apps/web/app/(main)/documents/[id]/page.tsx`

替换 textarea，完整集成：

**状态变量**：
- `title`, `content`, `tagIds` (文档数据)
- `viewMode: 'edit' | 'preview' | 'split'` (默认 'split')
- `cursorPos: { line, col }`
- `wordCount: number`（中文字符 + 英文单词计数）
- `shortcutPanelOpen`, `mathDialogOpen`, `imageDialogOpen`
- `autoSaveStatus` (来自 useAutoSave)

**组件树**：
```
<div className="flex flex-col h-full">
  <Header: 返回 + 面包屑 + 标题 + 标签 + 保存/删除>
  <EditorToolbar>（编辑/分屏模式显示）
  <div className="flex-1 flex overflow-hidden">
    <EditorWithUpload>（编辑/分屏模式，分屏时 w-1/2）
    <MarkdownPreview>（预览/分屏模式，分屏时 w-1/2）
  </div>
  <EditorStatusBar>
  <ShortcutPanel>
  <MathInsertDialog>
  <ImageInsertDialog>
</div>
```

**数据流**：
1. 首次加载从 API 获取文档数据 → 填充 title/content/tagIds
2. 编辑器 onChange → 更新 content → scheduleAutoSave()
3. Ctrl+S → manualSave()
4. 状态栏 viewMode 切换控制编辑/预览区域显示

### 5.9 新建文档页重构

**修改文件**: `apps/web/app/(main)/documents/new/page.tsx`

- 同样使用 CodeMirror 编辑器
- 无自动保存（新文档未持久化）
- "创建文档"按钮 → 调用 createDocument API → 跳转到编辑页

---

## 6. 文件清单

```
新增 (7 files)
├── apps/web/components/editor/
│   ├── codemirror-editor.tsx       # CM6 核心编辑器组件 (272行)
│   ├── editor-toolbar.tsx          # 格式化工具栏 (199行)
│   ├── editor-status-bar.tsx       # 底部状态栏 (70行)
│   ├── editor-commands.ts          # 工具栏辅助函数 (168行)
│   └── shortcut-panel.tsx          # 快捷键参考面板 (86行)
├── apps/web/hooks/
│   └── use-auto-save.ts            # 自动保存 Hook (72行)
└── apps/web/lib/
    └── editor-keybindings.ts       # 快捷键定义与配置 (73行)

修改 (2 files)
├── apps/web/app/(main)/documents/[id]/page.tsx   # textarea → CodeMirror + 分屏
└── apps/web/app/(main)/documents/new/page.tsx    # textarea → CodeMirror
```

---

## 7. 验证方案

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 编辑器加载 | 打开已有文档 | CodeMirror 显示内容，行号可见，语法高亮 |
| 实时预览 | 分屏模式编辑 | 右侧预览实时跟随更新 |
| 工具栏粗体 | 选中文字 → 点击 B | 选中文字被 `**` 包裹 |
| 工具栏标题 | 点击 H1 → 再次 H1 | 添加 `# ` → 移除（Toggle） |
| 自动保存 | 编辑后等待 2s | 状态栏显示"保存中..."→"已保存 (HH:mm)" |
| 手动保存 | Ctrl+S | 立即保存，取消待执行的自动保存 |
| 查找替换 | Ctrl+F / Ctrl+H | CM6 内置面板打开，支持正则匹配/替换 |
| 多光标 | Ctrl+D 连续按 | 依次选中相同词，同时编辑 |
| 块选择 | Alt+Shift+拖动 | 矩形区域选择 |
| 快捷键面板 | Ctrl+/ | 浮窗分组展示所有快捷键 |
| 视图切换 | 状态栏按钮 | 编辑/预览/分屏正确切换 |
| 中文输入 | 输入法编辑 | 流畅无异常（isExternalUpdate 保护） |
| 大文档 | 粘贴 10000+ 字 | 无明显卡顿 |
| 表格插入 | 工具栏表格按钮 | 6x6 网格选择器，点击生成对应尺寸表格 |
| 构建 | `pnpm --filter @kb/web build` | 通过 |

---

## 8. 完成标准

- [x] CodeMirror 编辑器正确初始化，Markdown 语法高亮
- [x] 分屏模式左编辑右预览，实时同步
- [x] 编辑/预览/分屏三种模式可切换
- [x] 工具栏所有按钮功能正常（标题、粗体、斜体、删除线、列表、链接、代码块、表格模板、引用、分隔线）
- [x] 自动保存生效（防抖 2s），状态栏正确显示保存状态
- [x] Ctrl+S 手动保存可用
- [x] 字数统计和光标位置实时显示
- [x] Ctrl+F 查找 / Ctrl+H 替换正常，支持正则
- [x] Ctrl+D 多光标选中，Alt+Click 添加光标
- [x] Alt+Shift+拖动矩形选择
- [x] Ctrl+/ 快捷键参考面板
- [x] 中文输入法兼容
- [x] textarea 临时编辑器完全移除
- [x] 前端构建通过
