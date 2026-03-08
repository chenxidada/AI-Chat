# Phase 1-3 Spec: 增强 Markdown 编辑器（总览）

> **本文档为 Phase 1-3 总览索引，详细实现规格已拆分为三个独立 spec 文档。**

## 1. 总体目标

将 Phase 1-1b 的临时 textarea 替换为功能完整的专业 Markdown 编辑器，覆盖以下能力：

1. **基础编辑**：CodeMirror 6 源码编辑器 + 工具栏 + 自动保存 + 分屏预览
2. **高级编辑**：多光标编辑、块选择（矩形选择）
3. **数学公式**：LaTeX 行内/块级公式编辑与 KaTeX 预览
4. **表格增强**：所见即所得表格编辑（增删行列、Tab 导航、对齐控制）
5. **图片管理**：本地上传、拖拽/粘贴插入、图片库管理
6. **快捷键系统**：完整可配置快捷键 + Ctrl+/ 参考面板
7. **文档内搜索**：Ctrl+F 查找 / Ctrl+H 替换（支持正则）

---

## 2. 子阶段拆分

Phase 1-3 拆分为三个递进子阶段：

| 子阶段 | 名称 | 核心交付 | Spec 文件 | 状态 |
|--------|------|---------|-----------|------|
| **1-3a** | 核心编辑器 + 高级编辑 | CM6 编辑器、工具栏、自动保存、快捷键、搜索替换 | [`phase1-3a-spec.md`](phase1-3a-spec.md) | 已完成 |
| **1-3b** | 数学公式 + WYSIWYG 表格 | KaTeX 公式渲染、公式对话框、表格编辑器 | [`phase1-3b-spec.md`](phase1-3b-spec.md) | 已完成 |
| **1-3c** | 图片上传与管理 | 后端 API + 前端上传/拖拽/粘贴 + 图片库 | [`phase1-3c-spec.md`](phase1-3c-spec.md) | 已完成 |

---

## 3. 依赖关系

```
Phase 1-3a (基础设施，必须先做)
    │
    ├─→ Phase 1-3b (依赖 CM6 EditorView ref + EditorToolbar onMathInsert 回调)
    │     ├── 数学公式（相对独立）
    │     └── WYSIWYG 表格（复杂度较高）
    │
    └─→ Phase 1-3c (后端可与 1-3b 并行)
          ├── 后端 API + Schema 迁移（无前端依赖）
          └── 前端上传集成（依赖 CM6 wrapper div + EditorToolbar onImageInsert 回调）
```

---

## 4. 技术栈总览

| 组件 | 技术 | 引入阶段 |
|------|------|---------|
| 源码编辑器 | CodeMirror 6 | 1-3a |
| Markdown 语言 | @codemirror/lang-markdown | 1-3a |
| 搜索/替换 | @codemirror/search | 1-3a |
| 多光标/矩形选择 | @codemirror/view (built-in) | 1-3a |
| 数学渲染 | KaTeX + remark-math + rehype-katex | 1-3b |
| 表格解析 | 自定义 table-parser.ts | 1-3b |
| 预览渲染 | react-markdown + remark-gfm | 复用 Phase 1-2 |
| 代码高亮 | rehype-highlight | 复用 Phase 1-2 |
| 图片上传 | multer + diskStorage | 1-3c |
| 图片存储 | 本地文件系统 (uploads/) | 1-3c |
| 静态服务 | @nestjs/serve-static | 1-3c |

---

## 5. 全量文件产出清单

```
Phase 1-3 总计：新增 19 文件，修改 5 文件

=== Phase 1-3a (9 files) ===

新增 (7 files)
├── apps/web/components/editor/
│   ├── codemirror-editor.tsx       # CM6 核心编辑器组件
│   ├── editor-toolbar.tsx          # 格式化工具栏
│   ├── editor-status-bar.tsx       # 底部状态栏
│   ├── editor-commands.ts          # 工具栏辅助函数
│   └── shortcut-panel.tsx          # 快捷键参考面板
├── apps/web/hooks/
│   └── use-auto-save.ts            # 自动保存 Hook
└── apps/web/lib/
    └── editor-keybindings.ts       # 快捷键定义与配置

修改 (2 files)
├── apps/web/app/(main)/documents/[id]/page.tsx
└── apps/web/app/(main)/documents/new/page.tsx

=== Phase 1-3b (5+3 files) ===

新增 (5 files)
├── apps/web/components/editor/
│   ├── math-insert-dialog.tsx
│   └── table-editor/
│       ├── index.tsx
│       ├── table-parser.ts
│       ├── table-cell.tsx
│       └── table-context-menu.tsx

修改 (3 files)
├── apps/web/components/documents/markdown-preview.tsx
├── apps/web/app/(main)/documents/[id]/page.tsx
└── apps/web/app/(main)/documents/new/page.tsx

=== Phase 1-3c (7+4 files) ===

新增 (7 files)
├── apps/api/src/modules/images/
│   ├── images.module.ts
│   ├── images.controller.ts
│   ├── images.service.ts
│   └── dto/upload-image.dto.ts
├── apps/web/components/editor/
│   ├── image-insert-dialog.tsx
│   └── editor-with-upload.tsx
└── apps/web/hooks/
    └── use-images.ts

修改 (4 files)
├── apps/api/prisma/schema.prisma
├── apps/api/src/app.module.ts
├── apps/web/app/(main)/documents/[id]/page.tsx
└── apps/web/app/(main)/documents/new/page.tsx
```

---

## 6. 完成标准

### Phase 1-3a（已完成）
- [x] CodeMirror 编辑器 + Markdown 语法高亮
- [x] 分屏预览 + 三种视图模式切换
- [x] 工具栏全部按钮功能
- [x] 自动保存（2s 防抖）+ Ctrl+S 手动保存
- [x] 查找替换 + 多光标 + 矩形选择
- [x] 快捷键参考面板
- [x] 字数统计 + 光标位置 + 保存状态

### Phase 1-3b（已完成）
- [x] 行内/块级数学公式 KaTeX 渲染
- [x] 公式插入对话框（模板 + 预览）
- [x] WYSIWYG 表格编辑器
- [x] Tab/Enter 键盘导航 + 右键菜单增删行列
- [x] 6x6 网格选择器插入表格

### Phase 1-3c（已完成）
- [x] 后端图片上传/查询/删除 API
- [x] 本地静态文件服务
- [x] 拖拽/粘贴自动上传（占位符机制）
- [x] 图片插入对话框（本地上传/URL/图片库）
- [x] DocumentImage 数据库表
- [x] 前后端构建均通过
