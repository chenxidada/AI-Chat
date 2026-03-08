# Phase 1-3c Spec: 图片管理

## 1. 目标

实现完整的图片管理能力，包含后端 API 和前端交互：

1. **后端图片模块**：上传、查询、删除 API + 本地文件存储 + 静态文件服务
2. **数据库模型**：DocumentImage 表记录图片元数据
3. **图片插入对话框**：本地上传 / URL 输入 / 图片库 三个 Tab
4. **拖拽/粘贴上传**：编辑器内拖拽图片或粘贴截图自动上传
5. **占位符机制**：上传期间显示占位符，完成后替换为实际 Markdown 图片语法

---

## 2. 前置条件

- Phase 1-3a 全部完成（CodeMirror 编辑器包裹 div 可监听拖拽/粘贴事件，EditorToolbar 有 `onImageInsert` 回调预留）

---

## 3. 新增依赖

```bash
# apps/api
pnpm --filter @kb/api add @nestjs/serve-static multer uuid
pnpm --filter @kb/api add -D @types/multer @types/uuid
```

---

## 4. 数据库 Schema 变更

**修改文件**: `apps/api/prisma/schema.prisma`

```prisma
model DocumentImage {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  documentId   String?  @map("document_id") @db.Uuid
  filename     String   @db.VarChar(255)       // 服务器存储文件名 (UUID.ext)
  originalName String   @map("original_name") @db.VarChar(255)  // 原始文件名
  mimeType     String   @map("mime_type") @db.VarChar(100)
  size         Int                              // 文件大小 (bytes)
  url          String   @db.VarChar(500)        // 可访问的相对 URL
  createdAt    DateTime @default(now()) @map("created_at")

  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([documentId])
  @@map("document_images")
}

// Document 模型新增关联：
model Document {
  // ... 现有字段
  images DocumentImage[]
}
```

**迁移**: `npx prisma migrate dev --name add_document_images`

**关键设计决策**：
- `documentId` 可为 null：支持孤立图片（新建文档未保存时上传的图片）
- `onDelete: SetNull`：文档删除后图片记录保留，不丢失文件
- `url` 存储相对路径 `/uploads/images/xxx.ext`，前端拼接 API 基地址

---

## 5. 后端模块设计

### 5.1 模块结构

```
apps/api/src/modules/images/
├── images.module.ts
├── images.controller.ts
├── images.service.ts
└── dto/
    └── upload-image.dto.ts
```

### 5.2 ImagesModule

**新增文件**: `apps/api/src/modules/images/images.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
```

### 5.3 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/images/upload` | 上传单张图片 (multipart/form-data) |
| GET | `/v1/images?documentId=xxx` | 查询文档关联的图片列表 |
| DELETE | `/v1/images/:id` | 删除图片（文件 + 数据库记录） |

### 5.4 上传端点详情

**POST /v1/images/upload**

- Content-Type: `multipart/form-data`
- 参数：
  - `file` (FormData): 图片文件
  - `documentId` (FormData, optional): 关联文档 ID

**Multer 配置**：

```typescript
FileInterceptor('file', {
  storage: diskStorage({
    destination: path.join(process.cwd(), 'uploads', 'images'),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
})
```

**成功响应 (201)**：

```json
{
  "id": "uuid",
  "url": "/uploads/images/abc123.jpg",
  "originalName": "photo.jpg",
  "size": 123456,
  "mimeType": "image/jpeg"
}
```

**错误响应**：413 (文件过大), 415 (不支持的类型), 400 (无文件)

### 5.5 UploadImageDto

**新增文件**: `apps/api/src/modules/images/dto/upload-image.dto.ts`

```typescript
export class UploadImageDto {
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
```

### 5.6 ImagesService

**新增文件**: `apps/api/src/modules/images/images.service.ts`

| 方法 | 功能 |
|------|------|
| `uploadImage(file, documentId?)` | 创建数据库记录（url = `/uploads/images/{filename}`），返回完整 DocumentImage |
| `findByDocument(documentId)` | 按 documentId 查询，按 createdAt 倒序 |
| `findOne(id)` | 按 ID 查找单条 |
| `remove(id)` | 查出记录 → `fs.unlinkSync` 删除文件 → 删除数据库记录；文件不存在时 warn 但不抛错 |

### 5.7 静态文件服务

**修改文件**: `apps/api/src/app.module.ts`

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), 'uploads'),
  serveRoot: '/uploads',
  serveStaticOptions: {
    index: false,  // 禁止目录列表
  },
}),
```

同时在 AppModule 的 imports 中注册 `ImagesModule`。

### 5.8 文件存储目录

```bash
mkdir -p uploads/images
```

上传的图片存储路径：`{project_root}/uploads/images/{uuid}.{ext}`

---

## 6. 前端模块设计

### 6.1 React Query Hooks

**新增文件**: `apps/web/hooks/use-images.ts`

```typescript
export interface DocumentImage {
  id: string;
  documentId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

// useDocumentImages(documentId: string | null)
//   - queryKey: ['images', documentId]
//   - enabled: !!documentId
//   - GET /v1/images?documentId=xxx

// useUploadImage()
//   - mutationFn: POST /v1/images/upload (FormData: file + documentId)
//   - onSuccess: invalidateQueries(['images'])

// useDeleteImage()
//   - mutationFn: DELETE /v1/images/:id
//   - onSuccess: invalidateQueries(['images'])
```

### 6.2 图片 URL 工具函数

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getImageFullUrl(url: string) {
  if (url.startsWith('http')) return url;
  const base = API_URL.replace(/\/api$/, '');
  return `${base}${url}`;
}
```

将相对路径 `/uploads/images/xxx.png` 转换为完整 URL `http://localhost:4000/uploads/images/xxx.png`。

### 6.3 图片插入对话框

**新增文件**: `apps/web/components/editor/image-insert-dialog.tsx`

```typescript
interface ImageInsertDialogProps {
  open: boolean;
  onClose: () => void;
  editorRef: React.RefObject<EditorHandle | null>;
  documentId?: string;
}
```

**三个 Tab**：

#### Tab 1: 本地上传

```
┌──────────────────────────────────────┐
│                                      │
│    [图片图标]                         │
│    拖拽图片到此处，或点击选择文件        │
│    支持 JPEG、PNG、GIF、WebP，最大 10MB │
│                                      │
└──────────────────────────────────────┘
```

- 拖拽上传 + 点击选择文件
- 上传中显示旋转加载动画
- 文件类型过滤：`accept="image/jpeg,image/png,image/gif,image/webp"`
- 上传完成自动插入 Markdown 并关闭对话框

#### Tab 2: URL 链接

- 图片 URL 输入框 + Enter 提交
- 替代文本 (alt) 输入框
- URL 非空时显示实时预览（`<img>` 加载失败时隐藏）
- "插入图片"按钮

#### Tab 3: 图片库

- 未保存文档时显示提示"保存文档后可使用图片库"
- 已保存文档：3 列网格显示缩略图
  - 每张图：缩略图 + 文件名 + 文件大小
  - 点击图片 → 插入到编辑器
  - 悬停显示删除按钮（右上角，确认删除）

**插入行为**：
```typescript
insertTemplate(view, `![${alt || '图片'}](${url})`);
```

### 6.4 编辑器拖拽/粘贴上传包裹组件

**新增文件**: `apps/web/components/editor/editor-with-upload.tsx`

```typescript
interface EditorWithUploadProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
  placeholder?: string;
  className?: string;
  documentId?: string;
}
```

**核心机制 - 占位符上传**：

1. 用户拖拽/粘贴图片文件
2. 立即在光标位置插入占位符：`![uploading filename...]()` 
3. 调用 `uploadImage.mutateAsync()` 上传文件
4. 上传成功：搜索占位符文本 → 替换为 `![originalName](fullUrl)`
5. 上传失败：搜索占位符文本 → 移除

**事件处理**：

| 事件 | 处理 |
|------|------|
| `onDrop` | 检查 `dataTransfer.files` → 过滤 `image/*` → `handleImageFile()` |
| `onDragOver` | `e.preventDefault()` + 检查 `e.dataTransfer.types.includes('Files')` → `setDragOver(true)` |
| `onDragLeave` | `setDragOver(false)` |
| `onPaste` | 检查 `clipboardData.items` → 过滤 `image/*` → `getAsFile()` → `handleImageFile()` |

**拖拽覆盖层**：`dragOver` 为 true 时显示蓝色半透明覆盖层 + "释放以上传图片"提示。

**Ref 合并**：通过 `setRef` 回调同时设置 innerRef（内部使用）和 forwardRef（父组件使用）。

### 6.5 页面集成

**修改文件**: `apps/web/app/(main)/documents/[id]/page.tsx` 和 `new/page.tsx`

- 将 `CodeMirrorEditor` 替换为 `EditorWithUpload`，传入 `documentId`
- 新增 `imageDialogOpen` 状态
- `EditorToolbar` 传入 `onImageInsert={() => setImageDialogOpen(true)}`
- `ImageInsertDialog` 组件挂载在页面底部

---

## 7. 文件清单

```
新增 (7 files)
├── apps/api/src/modules/images/
│   ├── images.module.ts              # NestJS 模块注册
│   ├── images.controller.ts          # 上传/查询/删除端点 (92行)
│   ├── images.service.ts             # 业务逻辑 (62行)
│   └── dto/upload-image.dto.ts       # 上传参数 DTO
├── apps/web/components/editor/
│   ├── image-insert-dialog.tsx       # 图片插入对话框 (302行)
│   └── editor-with-upload.tsx        # 拖拽/粘贴上传编辑器包裹 (155行)
└── apps/web/hooks/
    └── use-images.ts                 # React Query hooks

修改 (4 files)
├── apps/api/prisma/schema.prisma                    # +DocumentImage 模型
├── apps/api/src/app.module.ts                       # +ImagesModule +ServeStaticModule
├── apps/web/app/(main)/documents/[id]/page.tsx      # +EditorWithUpload +ImageInsertDialog
└── apps/web/app/(main)/documents/new/page.tsx       # +EditorWithUpload +ImageInsertDialog
```

---

## 8. 验证方案

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 上传 API | POST JPEG 文件到 /v1/images/upload | 201 + 返回 id/url/originalName |
| 文件限制 | 上传 >10MB 文件 | 413 错误 |
| 类型限制 | 上传 .txt 文件 | 415 错误 |
| 静态服务 | 浏览器访问 /uploads/images/xxx.jpg | 图片正常显示 |
| 查询 API | GET /v1/images?documentId=xxx | 返回图片列表（按创建时间倒序） |
| 删除 API | DELETE /v1/images/:id | 文件 + 数据库记录同时删除 |
| 拖拽上传 | 拖入图片到编辑器 | 占位符 → 替换为 `![name](url)` |
| 粘贴上传 | Ctrl+V 粘贴截图 | 自动上传并插入 Markdown 图片语法 |
| 上传失败 | 断网时上传 | 占位符被移除，不残留 |
| 拖拽覆盖 | 拖拽文件进入编辑区 | 蓝色覆盖层 + "释放以上传图片" |
| 对话框上传 | Tab1 拖拽或选择文件 | 上传成功后自动插入并关闭 |
| URL 插入 | Tab2 输入 URL → 插入 | 实时预览 + 正确插入 Markdown |
| 图片库 | Tab3 点击已上传图片 | 插入到编辑器 |
| 图片库删除 | Tab3 悬停 → 点击删除 | 确认后删除文件 + 记录 |
| 新文档图片库 | 新建文档页 Tab3 | 显示"保存文档后可使用图片库" |
| 前端构建 | `pnpm --filter @kb/web build` | 通过 |
| 后端构建 | `pnpm --filter @kb/api build` | 通过 |

---

## 9. 完成标准

- [x] DocumentImage 数据库表正确迁移
- [x] 图片上传 API 正常（类型/大小校验，UUID 文件名）
- [x] 静态文件服务可访问上传图片
- [x] 查询和删除 API 正常工作
- [x] 文件删除时同时清理文件系统和数据库
- [x] 拖拽图片到编辑器自动上传并插入（占位符机制）
- [x] 粘贴截图自动上传并插入
- [x] 上传失败时占位符正确清理
- [x] 图片插入对话框三个 Tab 正常工作
- [x] 图片库管理（查看/删除）
- [x] 新文档页图片库正确提示
- [x] 前后端构建均通过
