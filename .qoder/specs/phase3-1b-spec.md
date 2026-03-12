# Phase 3-1b Spec: 模板系统

## 1. 目标

实现文档模板系统，支持创建、管理、使用模板，以及文档复制功能，提升文档创建效率。完成后：

- 模板 CRUD 完整可用
- 可从模板创建新文档
- 支持模板分类管理
- 文档复制功能可用

---

## 2. 前置条件

- [x] Phase 3-1a 完成（批量操作基础）
- [x] 文档 CRUD API 可用
- [x] 数据库运行正常

---

## 3. 数据库设计

### 3.1 新增模板表

```sql
-- 文档模板表
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) DEFAULT 'general',
    "content" TEXT DEFAULT '',
    "thumbnail" VARCHAR(500),
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- 索引
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");
CREATE INDEX "document_templates_sort_order_idx" ON "document_templates"("sort_order");

-- 触发器：自动更新 updated_at
CREATE TRIGGER update_document_templates_updated_at
    BEFORE UPDATE ON "document_templates"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 Prisma Schema

```prisma
// apps/api/prisma/schema.prisma

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
  @@index([sortOrder])
  @@map("document_templates")
}
```

---

## 4. 后端实现

### 4.1 目录结构

```
apps/api/src/modules/templates/
├── templates.module.ts
├── templates.service.ts
├── templates.controller.ts
└── dto/
    ├── create-template.dto.ts
    ├── update-template.dto.ts
    └── query-template.dto.ts
```

### 4.2 DTO 定义

```typescript
// apps/api/src/modules/templates/dto/create-template.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
  IsInt,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ description: '模板名称', minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '模板分类',
    enum: ['general', 'note', 'meeting', 'report', 'reading', 'other'],
    default: 'general',
  })
  @IsOptional()
  @IsIn(['general', 'note', 'meeting', 'report', 'reading', 'other'])
  category?: string;

  @ApiPropertyOptional({ description: '模板内容（Markdown）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '预览图 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
```

```typescript
// apps/api/src/modules/templates/dto/update-template.dto.ts

import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
```

```typescript
// apps/api/src/modules/templates/dto/query-template.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTemplateDto {
  @ApiPropertyOptional({ description: '分类筛选' })
  @IsOptional()
  @IsIn(['general', 'note', 'meeting', 'report', 'reading', 'other'])
  category?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
```

### 4.3 模板服务

```typescript
// apps/api/src/modules/templates/templates.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { QueryTemplateDto } from './dto/query-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  // 预设模板
  private readonly presetTemplates: CreateTemplateDto[] = [
    {
      name: '空白文档',
      description: '从空白开始创建文档',
      category: 'general',
      content: '',
      sortOrder: 0,
    },
    {
      name: '会议记录',
      description: '记录会议内容和决议',
      category: 'meeting',
      content: `# 会议记录

## 会议信息
- **日期**：
- **参与者**：
- **主持人**：

## 议题

### 议题一

**讨论内容**：

**决议**：

### 议题二

**讨论内容**：

**决议**：

## 待办事项
- [ ]
- [ ]

## 下次会议
- **时间**：
- **议题**：
`,
      sortOrder: 1,
    },
    {
      name: '读书笔记',
      description: '记录阅读心得和要点',
      category: 'reading',
      content: `# 《书名》读书笔记

## 基本信息
- **作者**：
- **出版社**：
- **阅读日期**：

## 内容摘要


## 核心观点

### 观点一


### 观点二


## 精彩摘录

> 引用内容

## 个人感悟


## 行动计划
- [ ]
`,
      sortOrder: 2,
    },
    {
      name: '周报',
      description: '每周工作总结',
      category: 'report',
      content: `# 周报

**日期范围**：YYYY-MM-DD ~ YYYY-MM-DD

## 本周完成

### 项目 A
- [x] 任务一
- [x] 任务二

### 项目 B
- [x] 任务一
- [ ] 任务二（进行中）

## 遇到的问题

1. 问题描述
   - 原因：
   - 解决方案：

## 下周计划

### 重点项目
- [ ] 任务一
- [ ] 任务二

## 其他

`,
      sortOrder: 3,
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 初始化预设模板（首次运行时）
   */
  async initPresetTemplates(): Promise<void> {
    const count = await this.prisma.documentTemplate.count();
    if (count === 0) {
      this.logger.log('初始化预设模板...');
      for (const template of this.presetTemplates) {
        await this.prisma.documentTemplate.create({ data: template });
      }
      this.logger.log(`已创建 ${this.presetTemplates.length} 个预设模板`);
    }
  }

  /**
   * 获取模板列表
   */
  async findAll(query: QueryTemplateDto) {
    const { category, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = category ? { category } : {};

    const [items, total] = await Promise.all([
      this.prisma.documentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.documentTemplate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取模板分类列表
   */
  async getCategories() {
    const result = await this.prisma.documentTemplate.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    return result.map((item) => ({
      category: item.category,
      count: item._count.id,
    }));
  }

  /**
   * 获取单个模板
   */
  async findOne(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`模板 ${id} 不存在`);
    }

    return template;
  }

  /**
   * 创建模板
   */
  async create(dto: CreateTemplateDto) {
    // 检查同名模板
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`模板名称 "${dto.name}" 已存在`);
    }

    return this.prisma.documentTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category || 'general',
        content: dto.content || '',
        thumbnail: dto.thumbnail,
        sortOrder: dto.sortOrder || 0,
      },
    });
  }

  /**
   * 更新模板
   */
  async update(id: string, dto: UpdateTemplateDto) {
    const template = await this.findOne(id);

    // 如果修改名称，检查是否重名
    if (dto.name && dto.name !== template.name) {
      const existing = await this.prisma.documentTemplate.findFirst({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`模板名称 "${dto.name}" 已存在`);
      }
    }

    return this.prisma.documentTemplate.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除模板
   */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { id };
  }

  /**
   * 从文档创建模板
   */
  async createFromDocument(documentId: string, name: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`文档 ${documentId} 不存在`);
    }

    return this.create({
      name,
      content: document.content,
      category: 'general',
    });
  }
}
```

### 4.4 文档复制服务扩展

```typescript
// apps/api/src/modules/documents/documents.service.ts 新增方法

/**
 * 复制文档
 */
async duplicate(id: string): Promise<Document> {
  const original = await this.prisma.document.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });

  if (!original) {
    throw new NotFoundException(`文档 ${id} 不存在`);
  }

  // 创建副本
  const copy = await this.prisma.document.create({
    data: {
      title: `${original.title} (副本)`,
      content: original.content,
      contentPlain: original.contentPlain,
      folderId: original.folderId,
      sourceType: 'manual',
      wordCount: original.wordCount,
      tags: original.tags.length
        ? {
            create: original.tags.map((t) => ({ tagId: t.tagId })),
          }
        : undefined,
    },
    include: {
      folder: true,
      tags: { include: { tag: true } },
    },
  });

  return copy;
}

/**
 * 从模板创建文档
 */
async createFromTemplate(
  templateId: string,
  data: { title?: string; folderId?: string },
): Promise<Document> {
  const template = await this.prisma.documentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new NotFoundException(`模板 ${templateId} 不存在`);
  }

  return this.prisma.document.create({
    data: {
      title: data.title || template.name,
      content: template.content,
      contentPlain: this.extractPlainText(template.content),
      wordCount: this.countWords(template.content),
      folderId: data.folderId || null,
      sourceType: 'manual',
    },
    include: {
      folder: true,
      tags: { include: { tag: true } },
    },
  });
}
```

### 4.5 控制器

```typescript
// apps/api/src/modules/templates/templates.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { QueryTemplateDto } from './dto/query-template.dto';

@ApiTags('文档模板')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: '获取模板列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAll(@Query() query: QueryTemplateDto) {
    return this.templatesService.findAll(query);
  }

  @Get('categories')
  @ApiOperation({ summary: '获取模板分类' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getCategories() {
    return this.templatesService.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取模板详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建模板' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 409, description: '模板名称已存在' })
  async create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Post('from-document/:documentId')
  @ApiOperation({ summary: '从文档创建模板' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async createFromDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body('name') name: string,
  ) {
    return this.templatesService.createFromDocument(documentId, name);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新模板' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除模板' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.remove(id);
  }
}
```

```typescript
// apps/api/src/modules/documents/documents.controller.ts 新增端点

@Post(':id/duplicate')
@ApiOperation({ summary: '复制文档' })
@ApiResponse({ status: 201, description: '复制成功' })
async duplicate(@Param('id', ParseUUIDPipe) id: string) {
  return this.documentsService.duplicate(id);
}

@Post('from-template/:templateId')
@ApiOperation({ summary: '从模板创建文档' })
@ApiResponse({ status: 201, description: '创建成功' })
async createFromTemplate(
  @Param('templateId', ParseUUIDPipe) templateId: string,
  @Body() data: { title?: string; folderId?: string },
) {
  return this.documentsService.createFromTemplate(templateId, data);
}
```

### 4.6 模块注册

```typescript
// apps/api/src/modules/templates/templates.module.ts

import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';

@Module({
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
```

```typescript
// apps/api/src/app.module.ts 更新

import { TemplatesModule } from './modules/templates/templates.module';

@Module({
  imports: [
    // ... 原有模块
    TemplatesModule,
  ],
})
export class AppModule {}
```

---

## 5. 前端实现

### 5.1 目录结构

```
apps/web/
├── components/templates/
│   ├── template-list.tsx         # 模板列表
│   ├── template-card.tsx         # 模板卡片
│   ├── template-dialog.tsx       # 模板创建/编辑对话框
│   └── template-selector.tsx     # 模板选择器（创建文档时）
├── hooks/
│   └── use-templates.ts          # 模板 Hook
```

### 5.2 模板 Hook

```typescript
// apps/web/hooks/use-templates.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content: string;
  thumbnail: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCategory {
  category: string;
  count: number;
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTemplates = useCallback(async (category?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      params.append('limit', '100');

      const response = await apiClient.get<{ items: Template[] }>(
        `/templates?${params.toString()}`,
      );
      setTemplates(response.data.items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const response = await apiClient.get<TemplateCategory[]>(
      '/templates/categories',
    );
    setCategories(response.data);
  }, []);

  const createTemplate = useCallback(
    async (data: Partial<Template>) => {
      const response = await apiClient.post<Template>('/templates', data);
      await fetchTemplates();
      return response.data;
    },
    [fetchTemplates],
  );

  const updateTemplate = useCallback(
    async (id: string, data: Partial<Template>) => {
      const response = await apiClient.put<Template>(`/templates/${id}`, data);
      await fetchTemplates();
      return response.data;
    },
    [fetchTemplates],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      await apiClient.delete(`/templates/${id}`);
      await fetchTemplates();
    },
    [fetchTemplates],
  );

  const createFromDocument = useCallback(
    async (documentId: string, name: string) => {
      const response = await apiClient.post<Template>(
        `/templates/from-document/${documentId}`,
        { name },
      );
      await fetchTemplates();
      return response.data;
    },
    [fetchTemplates],
  );

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, [fetchTemplates, fetchCategories]);

  return {
    templates,
    categories,
    isLoading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createFromDocument,
  };
}
```

### 5.3 模板卡片组件

```typescript
// apps/web/components/templates/template-card.tsx

'use client';

import { useState } from 'react';
import { MoreVertical, FileText, Edit, Trash2, Copy } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Template } from '@/hooks/use-templates';

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
}

const categoryLabels: Record<string, string> = {
  general: '通用',
  note: '笔记',
  meeting: '会议',
  report: '报告',
  reading: '读书',
  other: '其他',
};

export function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: TemplateCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => onUse(template)}>
            <CardTitle className="text-base font-medium">
              {template.name}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {categoryLabels[template.category] || template.category}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onUse(template)}>
                <Copy className="h-4 w-4 mr-2" />
                使用模板
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(template.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {template.description || '暂无描述'}
        </p>
        {template.content && (
          <div
            className="mt-2 text-xs text-muted-foreground/60 line-clamp-2 font-mono bg-muted/50 p-2 rounded"
            onMouseEnter={() => setShowPreview(true)}
            onMouseLeave={() => setShowPreview(false)}
          >
            {template.content.slice(0, 100)}...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 5.4 模板列表组件

```typescript
// apps/web/components/templates/template-list.tsx

'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplateCard } from './template-card';
import { TemplateDialog } from './template-dialog';
import { useTemplates, Template } from '@/hooks/use-templates';

interface TemplateListProps {
  onSelectTemplate?: (template: Template) => void;
  selectionMode?: boolean;
}

export function TemplateList({
  onSelectTemplate,
  selectionMode = false,
}: TemplateListProps) {
  const {
    templates,
    categories,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTemplates();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const filteredTemplates =
    activeCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个模板吗？')) {
      await deleteTemplate(id);
    }
  };

  const handleSave = async (data: Partial<Template>) => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, data);
    } else {
      await createTemplate(data);
    }
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">模板管理</h2>
        {!selectionMode && (
          <Button
            onClick={() => {
              setEditingTemplate(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        )}
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat.category} value={cat.category}>
              {cat.category} ({cat.count})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暂无模板
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={
                    selectionMode
                      ? onSelectTemplate!
                      : () => console.log('Use template', template)
                  }
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSave={handleSave}
      />
    </div>
  );
}
```

### 5.5 模板对话框组件

```typescript
// apps/web/components/templates/template-dialog.tsx

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Template } from '@/hooks/use-templates';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSave: (data: Partial<Template>) => void;
}

const categories = [
  { value: 'general', label: '通用' },
  { value: 'note', label: '笔记' },
  { value: 'meeting', label: '会议' },
  { value: 'report', label: '报告' },
  { value: 'reading', label: '读书' },
  { value: 'other', label: '其他' },
];

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    content: '',
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category,
        content: template.content,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'general',
        content: '',
      });
    }
  }, [template, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? '编辑模板' : '新建模板'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">模板名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="输入模板名称"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">分类</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="模板描述（可选）"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">模板内容</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="输入 Markdown 模板内容"
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.6 模板选择器（创建文档时使用）

```typescript
// apps/web/components/templates/template-selector.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplateCard } from './template-card';
import { useTemplates, Template } from '@/hooks/use-templates';
import { apiClient } from '@/lib/api-client';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
}

export function TemplateSelector({
  open,
  onOpenChange,
  folderId,
}: TemplateSelectorProps) {
  const router = useRouter();
  const { templates, categories } = useTemplates();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const handleSelectTemplate = async (template: Template) => {
    try {
      const response = await apiClient.post<{ id: string }>(
        '/documents/from-template/' + template.id,
        { folderId },
      );
      onOpenChange(false);
      router.push(`/documents/${response.data.id}`);
    } catch (error) {
      console.error('创建文档失败', error);
    }
  };

  const filteredTemplates =
    activeCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>选择模板创建文档</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeCategory}
          onValueChange={setActiveCategory}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="all">全部</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat.category} value={cat.category}>
                {cat.category}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent
            value={activeCategory}
            className="flex-1 overflow-auto mt-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={handleSelectTemplate}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 6. 共享类型定义

```typescript
// packages/shared/src/types/template.ts

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content: string;
  thumbnail: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category?: string;
  content?: string;
  thumbnail?: string;
  sortOrder?: number;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface TemplateQueryParams {
  category?: string;
  page?: number;
  limit?: number;
}

export interface TemplateCategory {
  category: string;
  count: number;
}
```

---

## 7. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/templates` | 获取模板列表 |
| GET | `/api/templates/categories` | 获取模板分类 |
| GET | `/api/templates/:id` | 获取模板详情 |
| POST | `/api/templates` | 创建模板 |
| POST | `/api/templates/from-document/:documentId` | 从文档创建模板 |
| PUT | `/api/templates/:id` | 更新模板 |
| DELETE | `/api/templates/:id` | 删除模板 |
| POST | `/api/documents/from-template/:templateId` | 从模板创建文档 |
| POST | `/api/documents/:id/duplicate` | 复制文档 |

---

## 8. 文件产出清单

```
Phase 3-1b 总计：新增 8 文件，修改 3 文件

后端新增 (4 files):
├── src/modules/templates/
│   ├── templates.module.ts
│   ├── templates.service.ts
│   ├── templates.controller.ts
│   └── dto/
│       ├── create-template.dto.ts
│       ├── update-template.dto.ts
│       └── query-template.dto.ts

后端修改 (2 files):
├── prisma/schema.prisma              # 添加 DocumentTemplate 模型
├── src/modules/documents/documents.service.ts  # 添加 duplicate, createFromTemplate
└── src/app.module.ts                 # 注册 TemplatesModule

前端新增 (5 files):
├── components/templates/
│   ├── template-list.tsx
│   ├── template-card.tsx
│   ├── template-dialog.tsx
│   └── template-selector.tsx
└── hooks/
    └── use-templates.ts

前端修改 (1 file):
└── app/(main)/documents/new/page.tsx  # 集成模板选择器

共享包新增 (1 file):
└── packages/shared/src/types/
    └── template.ts
```

---

## 9. 验证方案

### 9.1 后端验证

```bash
# 1. 数据库迁移
cd apps/api && npx prisma migrate dev --name add_document_templates

# 2. 创建模板
curl -X POST http://localhost:4000/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"测试模板","category":"note","content":"# 标题\n内容"}'

# 3. 获取模板列表
curl http://localhost:4000/api/templates

# 4. 从模板创建文档
curl -X POST http://localhost:4000/api/documents/from-template/{templateId} \
  -H "Content-Type: application/json" \
  -d '{"title":"从模板创建的文档"}'

# 5. 复制文档
curl -X POST http://localhost:4000/api/documents/{documentId}/duplicate
```

### 9.2 前端验证

```bash
# 启动前端
cd apps/web && npx next dev

# 测试项目
# 1. 模板列表显示
# 2. 模板分类切换
# 3. 创建新模板
# 4. 编辑模板
# 5. 删除模板
# 6. 从模板创建文档
# 7. 复制文档
```

---

## 10. 完成标准

- [ ] `document_templates` 表创建成功
- [ ] 模板 CRUD API 全部可用
- [ ] 从文档创建模板 API 可用
- [ ] 从模板创建文档 API 可用
- [ ] 文档复制 API 可用
- [ ] 预设模板初始化正常
- [ ] 前端模板列表显示正常
- [ ] 模板创建/编辑对话框可用
- [ ] 模板选择器集成到新建文档流程
- [ ] Swagger 文档更新
