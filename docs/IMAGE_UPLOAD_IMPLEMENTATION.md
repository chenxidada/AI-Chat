# 图片管理功能实现方案

## 概述

本文档说明如何从零实现图片上传、查询、删除功能。

---

## 1. 数据库模型

**文件**: `apps/api/prisma/schema.prisma`

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
```

**运行迁移**:
```bash
pnpm db:migrate
```

---

## 2. 后端模块

### 2.1 目录结构

```
apps/api/src/modules/images/
├── images.module.ts
├── images.controller.ts
├── images.service.ts
└── dto/
    └── upload-image.dto.ts
```

### 2.2 ImagesModule

```typescript
// images.module.ts
@Module({
  imports: [PrismaModule],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
```

### 2.3 ImagesController

```typescript
// images.controller.ts
@Controller('v1/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @UseInterceptors(
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
        cb(null, allowed.includes(file.mimetype));
      },
      limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentId') documentId?: string,
  ) {
    return this.imagesService.uploadImage(file, documentId);
  }

  @Get()
  async findByDocument(@Query('documentId') documentId: string) {
    return this.imagesService.findByDocument(documentId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.imagesService.remove(id);
  }
}
```

### 2.4 ImagesService

```typescript
// images.service.ts
@Injectable()
export class ImagesService {
  constructor(private prisma: PrismaService) {}

  async uploadImage(file: Express.Multer.File, documentId?: string) {
    const url = `/uploads/images/${file.filename}`;
    return this.prisma.documentImage.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        documentId: documentId || null,
      },
    });
  }

  async findByDocument(documentId: string) {
    return this.prisma.documentImage.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const image = await this.prisma.documentImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('图片不存在');

    // 删除文件
    const filePath = path.join(process.cwd(), 'uploads', 'images', image.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除数据库记录
    return this.prisma.documentImage.delete({ where: { id } });
  }
}
```

---

## 3. 静态文件服务

**修改**: `apps/api/src/app.module.ts`

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ImagesModule,
    // ... 其他模块
  ],
})
export class AppModule {}
```

---

## 4. 前端实现

### 4.1 React Query Hooks

```typescript
// hooks/use-images.ts
export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, documentId }: { file: File; documentId?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (documentId) formData.append('documentId', documentId);

      const res = await fetch('/api/v1/images/upload', {
        method: 'POST',
        body: formData,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['images'] }),
  });
}

export function useDocumentImages(documentId: string | null) {
  return useQuery({
    queryKey: ['images', documentId],
    queryFn: () => fetch(`/api/v1/images?documentId=${documentId}`).then(r => r.json()),
    enabled: !!documentId,
  });
}

export function useDeleteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/images/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['images'] }),
  });
}
```

### 4.2 图片插入对话框

核心功能：
- Tab 1: 本地上传（拖拽 + 点击选择）
- Tab 2: URL 输入
- Tab 3: 图片库（已上传图片列表）

### 4.3 拖拽上传

在编辑器外层包裹组件，监听：
- `onDrop`: 拖放文件
- `onPaste`: 粘贴图片

上传时显示占位符，完成后替换为 Markdown 图片语法。

---

## 5. 测试验证

### 5.1 单元测试

```typescript
// test/images.controller.spec.ts
describe('ImagesController', () => {
  it('should upload an image', async () => {
    const result = await controller.upload(mockFile, 'doc-id');
    expect(result.url).toBeDefined();
  });
});
```

### 5.2 E2E 测试

```typescript
// e2e/api-images.spec.ts
test('should upload an image successfully', async ({ request }) => {
  const response = await request.post('/api/v1/images/upload', {
    multipart: { file: { name: 'test.png', mimeType: 'image/png', buffer: pngBuffer } },
  });
  expect(response.status()).toBe(201);
});
```

---

## 6. 部署注意事项

1. **上传目录**: 确保 `uploads/images` 目录有写权限
2. **Nginx 配置**: 静态文件可由 Nginx 直接服务
3. **云存储**: 生产环境建议使用 S3/OSS 替代本地存储
4. **CDN**: 图片 URL 应使用 CDN 加速
