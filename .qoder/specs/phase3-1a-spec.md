# Phase 3-1a Spec: 批量操作 + 收藏置顶

## 1. 目标

实现文档和文件夹的批量操作功能，以及文档收藏、置顶功能，提升知识库的管理效率。完成后：

- 文档列表支持多选和批量操作
- 批量移动、标签、归档、删除操作可用
- 文档和文件夹支持收藏和置顶
- 侧边栏显示收藏夹快捷入口

---

## 2. 前置条件

- [x] Phase 1 完成（文档、文件夹、标签 CRUD）
- [x] Phase 2 完成（AI 对话功能）
- [x] 数据库运行正常

---

## 3. 数据库设计

### 3.1 扩展现有表

```sql
-- 扩展 documents 表
ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "is_favorite" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN DEFAULT FALSE;

-- 添加索引
CREATE INDEX IF NOT EXISTS "documents_is_favorite_idx" ON "documents"("is_favorite") WHERE "is_favorite" = TRUE;
CREATE INDEX IF NOT EXISTS "documents_is_pinned_idx" ON "documents"("is_pinned") WHERE "is_pinned" = TRUE;

-- 扩展 folders 表
ALTER TABLE "folders"
ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN DEFAULT FALSE;

-- 添加索引
CREATE INDEX IF NOT EXISTS "folders_is_pinned_idx" ON "folders"("is_pinned") WHERE "is_pinned" = TRUE;
```

### 3.2 Prisma Schema 更新

```prisma
// apps/api/prisma/schema.prisma

model Document {
  // ... 原有字段

  // Phase 3-1a 新增字段
  isFavorite Boolean  @default(false) @map("is_favorite")
  isPinned   Boolean  @default(false) @map("is_pinned")

  // ... 原有关联
}

model Folder {
  // ... 原有字段

  // Phase 3-1a 新增字段
  isPinned Boolean @default(false) @map("is_pinned")

  // ... 原有关联
}
```

---

## 4. 后端实现

### 4.1 目录结构

```
apps/api/src/modules/
├── documents/
│   ├── documents-batch.service.ts   # 批量操作服务
│   ├── dto/
│   │   ├── batch-move.dto.ts
│   │   ├── batch-tag.dto.ts
│   │   └── batch-operation.dto.ts
│   └── ...
├── favorites/
│   ├── favorites.module.ts
│   ├── favorites.service.ts
│   └── favorites.controller.ts
```

### 4.2 批量操作 DTO

```typescript
// apps/api/src/modules/documents/dto/batch-operation.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BatchOperationDto {
  @ApiProperty({ description: '文档 ID 列表', type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: '至少选择一个文档' })
  @ArrayMaxSize(100, { message: '单次最多操作 100 个文档' })
  @IsUUID('4', { each: true })
  documentIds: string[];
}
```

```typescript
// apps/api/src/modules/documents/dto/batch-move.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';
import { BatchOperationDto } from './batch-operation.dto';

export class BatchMoveDto extends BatchOperationDto {
  @ApiPropertyOptional({ description: '目标文件夹 ID，null 表示移至未分类' })
  @IsOptional()
  @IsUUID('4')
  folderId?: string | null;
}
```

```typescript
// apps/api/src/modules/documents/dto/batch-tag.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsIn, IsOptional } from 'class-validator';
import { BatchOperationDto } from './batch-operation.dto';

export class BatchTagDto extends BatchOperationDto {
  @ApiProperty({ description: '标签 ID 列表', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds: string[];

  @ApiProperty({
    description: '操作模式',
    enum: ['add', 'remove', 'replace'],
    default: 'add',
  })
  @IsIn(['add', 'remove', 'replace'])
  mode: 'add' | 'remove' | 'replace';
}
```

### 4.3 批量操作服务

```typescript
// apps/api/src/modules/documents/documents-batch.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BatchMoveDto } from './dto/batch-move.dto';
import { BatchTagDto } from './dto/batch-tag.dto';

export interface BatchResult {
  success: boolean;
  affected: number;
  errors?: string[];
}

@Injectable()
export class DocumentsBatchService {
  private readonly logger = new Logger(DocumentsBatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 批量移动文档
   */
  async batchMove(dto: BatchMoveDto): Promise<BatchResult> {
    const { documentIds, folderId } = dto;

    // 验证目标文件夹存在
    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        throw new BadRequestException(`文件夹 ${folderId} 不存在`);
      }
    }

    try {
      const result = await this.prisma.document.updateMany({
        where: {
          id: { in: documentIds },
          isArchived: false,
        },
        data: {
          folderId: folderId || null,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量移动失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量标签操作
   */
  async batchTag(dto: BatchTagDto): Promise<BatchResult> {
    const { documentIds, tagIds, mode } = dto;

    // 验证标签存在
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
    });
    if (tags.length !== tagIds.length) {
      throw new BadRequestException('部分标签不存在');
    }

    try {
      let affected = 0;

      for (const docId of documentIds) {
        if (mode === 'add') {
          // 添加标签（忽略已存在的）
          await this.prisma.documentTag.createMany({
            data: tagIds.map((tagId) => ({
              documentId: docId,
              tagId,
            })),
            skipDuplicates: true,
          });
          affected++;
        } else if (mode === 'remove') {
          // 移除标签
          await this.prisma.documentTag.deleteMany({
            where: {
              documentId: docId,
              tagId: { in: tagIds },
            },
          });
          affected++;
        } else if (mode === 'replace') {
          // 替换标签：先删除所有，再添加新的
          await this.prisma.$transaction([
            this.prisma.documentTag.deleteMany({
              where: { documentId: docId },
            }),
            this.prisma.documentTag.createMany({
              data: tagIds.map((tagId) => ({
                documentId: docId,
                tagId,
              })),
            }),
          ]);
          affected++;
        }
      }

      return {
        success: true,
        affected,
      };
    } catch (error) {
      this.logger.error('批量标签操作失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量归档
   */
  async batchArchive(documentIds: string[]): Promise<BatchResult> {
    try {
      const result = await this.prisma.document.updateMany({
        where: { id: { in: documentIds } },
        data: {
          isArchived: true,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量归档失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量恢复
   */
  async batchRestore(documentIds: string[]): Promise<BatchResult> {
    try {
      const result = await this.prisma.document.updateMany({
        where: { id: { in: documentIds } },
        data: {
          isArchived: false,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量恢复失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量删除（永久删除）
   */
  async batchDelete(documentIds: string[]): Promise<BatchResult> {
    try {
      const result = await this.prisma.document.deleteMany({
        where: { id: { in: documentIds } },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量删除失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }
}
```

### 4.4 收藏服务

```typescript
// apps/api/src/modules/favorites/favorites.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取收藏的文档列表
   */
  async getFavorites(params: {
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          isFavorite: true,
          isArchived: false,
        },
        skip,
        take: limit,
        orderBy: [
          { isPinned: 'desc' },
          { updatedAt: 'desc' },
        ],
        include: {
          folder: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.document.count({
        where: {
          isFavorite: true,
          isArchived: false,
        },
      }),
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
   * 切换文档收藏状态
   */
  async toggleFavorite(documentId: string): Promise<{ isFavorite: boolean }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { isFavorite: true },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${documentId} 不存在`);
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { isFavorite: !doc.isFavorite },
    });

    return { isFavorite: updated.isFavorite };
  }

  /**
   * 切换文档置顶状态
   */
  async togglePin(documentId: string): Promise<{ isPinned: boolean }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { isPinned: true },
    });

    if (!doc) {
      throw new NotFoundException(`文档 ${documentId} 不存在`);
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { isPinned: !doc.isPinned },
    });

    return { isPinned: updated.isPinned };
  }

  /**
   * 切换文件夹置顶状态
   */
  async toggleFolderPin(folderId: string): Promise<{ isPinned: boolean }> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { isPinned: true },
    });

    if (!folder) {
      throw new NotFoundException(`文件夹 ${folderId} 不存在`);
    }

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: { isPinned: !folder.isPinned },
    });

    return { isPinned: updated.isPinned };
  }
}
```

### 4.5 控制器

```typescript
// apps/api/src/modules/documents/documents-batch.controller.ts

import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DocumentsBatchService } from './documents-batch.service';
import { BatchMoveDto } from './dto/batch-move.dto';
import { BatchTagDto } from './dto/batch-tag.dto';
import { BatchOperationDto } from './dto/batch-operation.dto';

@ApiTags('文档批量操作')
@Controller('documents')
export class DocumentsBatchController {
  constructor(private readonly batchService: DocumentsBatchService) {}

  @Post('batch-move')
  @ApiOperation({ summary: '批量移动文档' })
  @ApiResponse({ status: 200, description: '移动成功' })
  async batchMove(@Body() dto: BatchMoveDto) {
    return this.batchService.batchMove(dto);
  }

  @Post('batch-tag')
  @ApiOperation({ summary: '批量标签操作' })
  @ApiResponse({ status: 200, description: '操作成功' })
  async batchTag(@Body() dto: BatchTagDto) {
    return this.batchService.batchTag(dto);
  }

  @Post('batch-archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量归档文档' })
  @ApiResponse({ status: 200, description: '归档成功' })
  async batchArchive(@Body() dto: BatchOperationDto) {
    return this.batchService.batchArchive(dto.documentIds);
  }

  @Post('batch-restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量恢复文档' })
  @ApiResponse({ status: 200, description: '恢复成功' })
  async batchRestore(@Body() dto: BatchOperationDto) {
    return this.batchService.batchRestore(dto.documentIds);
  }

  @Post('batch-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量永久删除文档' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async batchDelete(@Body() dto: BatchOperationDto) {
    return this.batchService.batchDelete(dto.documentIds);
  }
}
```

```typescript
// apps/api/src/modules/favorites/favorites.controller.ts

import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';

@ApiTags('收藏与置顶')
@Controller()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('documents/favorites')
  @ApiOperation({ summary: '获取收藏的文档列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFavorites(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.favoritesService.getFavorites({ page, limit });
  }

  @Patch('documents/:id/favorite')
  @ApiOperation({ summary: '切换文档收藏状态' })
  @ApiResponse({ status: 200, description: '切换成功' })
  async toggleFavorite(@Param('id') id: string) {
    return this.favoritesService.toggleFavorite(id);
  }

  @Patch('documents/:id/pin')
  @ApiOperation({ summary: '切换文档置顶状态' })
  @ApiResponse({ status: 200, description: '切换成功' })
  async togglePin(@Param('id') id: string) {
    return this.favoritesService.togglePin(id);
  }

  @Patch('folders/:id/pin')
  @ApiOperation({ summary: '切换文件夹置顶状态' })
  @ApiResponse({ status: 200, description: '切换成功' })
  async toggleFolderPin(@Param('id') id: string) {
    return this.favoritesService.toggleFolderPin(id);
  }
}
```

### 4.6 模块注册

```typescript
// apps/api/src/modules/documents/documents.module.ts 更新

import { DocumentsBatchService } from './documents-batch.service';
import { DocumentsBatchController } from './documents-batch.controller';

@Module({
  // ...
  providers: [
    // ... 原有 providers
    DocumentsBatchService,
  ],
  controllers: [
    // ... 原有 controllers
    DocumentsBatchController,
  ],
})
export class DocumentsModule {}
```

```typescript
// apps/api/src/modules/favorites/favorites.module.ts

import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService],
})
export class FavoritesModule {}
```

---

## 5. 前端实现

### 5.1 目录结构

```
apps/web/
├── components/
│   ├── documents/
│   │   ├── document-selector.tsx      # 多选组件
│   │   ├── batch-actions-bar.tsx      # 批量操作栏
│   │   └── favorite-button.tsx        # 收藏按钮
│   └── layout/
│       └── favorites-sidebar.tsx      # 收藏夹侧边栏
├── hooks/
│   └── use-batch-operations.ts        # 批量操作 Hook
└── stores/
    └── selection-store.ts             # 选择状态 Store
```

### 5.2 选择状态 Store

```typescript
// apps/web/stores/selection-store.ts

import { create } from 'zustand';

interface SelectionStore {
  // 选中的文档 IDs
  selectedIds: Set<string>;
  isSelectAll: boolean;

  // 操作
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedIds: new Set<string>(),
  isSelectAll: false,

  toggleSelect: (id: string) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedIds: newSet, isSelectAll: false };
    });
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: new Set(ids), isSelectAll: true });
  },

  clearSelection: () => {
    set({ selectedIds: new Set(), isSelectAll: false });
  },

  isSelected: (id: string) => {
    return get().selectedIds.has(id);
  },
}));
```

### 5.3 批量操作 Hook

```typescript
// apps/web/hooks/use-batch-operations.ts

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useSelectionStore } from '@/stores/selection-store';
import { useToast } from '@/hooks/use-toast';

interface BatchResult {
  success: boolean;
  affected: number;
  errors?: string[];
}

export function useBatchOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { selectedIds, clearSelection } = useSelectionStore();
  const { toast } = useToast();

  const executeBatch = useCallback(
    async (
      operation: string,
      data: Record<string, unknown>,
      onSuccess?: () => void,
    ) => {
      if (selectedIds.size === 0) {
        toast({
          title: '请先选择文档',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiClient.post<BatchResult>(
          `/documents/${operation}`,
          {
            documentIds: Array.from(selectedIds),
            ...data,
          },
        );

        if (response.data.success) {
          toast({
            title: `操作成功`,
            description: `已处理 ${response.data.affected} 个文档`,
          });
          clearSelection();
          onSuccess?.();
        } else {
          toast({
            title: '操作失败',
            description: response.data.errors?.join(', '),
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: '操作失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [selectedIds, clearSelection, toast],
  );

  const batchMove = useCallback(
    (folderId: string | null, onSuccess?: () => void) => {
      executeBatch('batch-move', { folderId }, onSuccess);
    },
    [executeBatch],
  );

  const batchTag = useCallback(
    (tagIds: string[], mode: 'add' | 'remove' | 'replace', onSuccess?: () => void) => {
      executeBatch('batch-tag', { tagIds, mode }, onSuccess);
    },
    [executeBatch],
  );

  const batchArchive = useCallback(
    (onSuccess?: () => void) => {
      executeBatch('batch-archive', {}, onSuccess);
    },
    [executeBatch],
  );

  const batchRestore = useCallback(
    (onSuccess?: () => void) => {
      executeBatch('batch-restore', {}, onSuccess);
    },
    [executeBatch],
  );

  const batchDelete = useCallback(
    (onSuccess?: () => void) => {
      if (confirm('确定要永久删除选中的文档吗？此操作不可恢复。')) {
        executeBatch('batch-delete', {}, onSuccess);
      }
    },
    [executeBatch],
  );

  return {
    isLoading,
    selectedCount: selectedIds.size,
    batchMove,
    batchTag,
    batchArchive,
    batchRestore,
    batchDelete,
  };
}
```

### 5.4 批量操作栏组件

```typescript
// apps/web/components/documents/batch-actions-bar.tsx

'use client';

import { useState } from 'react';
import { Folder, Tag, Archive, Trash2, X, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSelectionStore } from '@/stores/selection-store';
import { useBatchOperations } from '@/hooks/use-batch-operations';
import { FolderTree } from './folder-tree';

interface BatchActionsBarProps {
  onRefresh?: () => void;
}

export function BatchActionsBar({ onRefresh }: BatchActionsBarProps) {
  const { selectedIds, clearSelection } = useSelectionStore();
  const { isLoading, batchMove, batchArchive, batchDelete } = useBatchOperations();
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  if (selectedIds.size === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-2 flex items-center gap-2">
        <span className="px-3 text-sm text-muted-foreground">
          已选择 {selectedIds.size} 个文档
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMoveDialog(true)}
          disabled={isLoading}
        >
          <Move className="h-4 w-4 mr-1" />
          移动
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => batchArchive(onRefresh)}
          disabled={isLoading}
        >
          <Archive className="h-4 w-4 mr-1" />
          归档
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => batchDelete(onRefresh)}
          disabled={isLoading}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          删除
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 移动对话框 */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>移动到文件夹</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            <FolderTree
              onSelect={(folderId) => {
                batchMove(folderId, () => {
                  setShowMoveDialog(false);
                  onRefresh?.();
                });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### 5.5 收藏按钮组件

```typescript
// apps/web/components/documents/favorite-button.tsx

'use client';

import { useState } from 'react';
import { Star, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  documentId: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  onToggle?: () => void;
}

export function FavoriteButton({
  documentId,
  isFavorite = false,
  isPinned = false,
  onToggle,
}: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [pinned, setPinned] = useState(isPinned);
  const [isLoading, setIsLoading] = useState(false);

  const toggleFavorite = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.patch<{ isFavorite: boolean }>(
        `/documents/${documentId}/favorite`,
      );
      setFavorite(response.data.isFavorite);
      onToggle?.();
    } finally {
      setIsLoading(false);
    }
  };

  const togglePin = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.patch<{ isPinned: boolean }>(
        `/documents/${documentId}/pin`,
      );
      setPinned(response.data.isPinned);
      onToggle?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFavorite}
        disabled={isLoading}
        title={favorite ? '取消收藏' : '收藏'}
      >
        <Star
          className={cn(
            'h-4 w-4',
            favorite && 'fill-yellow-400 text-yellow-400',
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePin}
        disabled={isLoading}
        title={pinned ? '取消置顶' : '置顶'}
      >
        <Pin
          className={cn(
            'h-4 w-4',
            pinned && 'fill-primary text-primary',
          )}
        />
      </Button>
    </div>
  );
}
```

### 5.6 收藏夹侧边栏组件

```typescript
// apps/web/components/layout/favorites-sidebar.tsx

'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface FavoriteDocument {
  id: string;
  title: string;
  isPinned: boolean;
  updatedAt: string;
}

export function FavoritesSidebar() {
  const [favorites, setFavorites] = useState<FavoriteDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await apiClient.get<{ items: FavoriteDocument[] }>(
        '/documents/favorites?limit=10',
      );
      setFavorites(response.data.items);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <Star className="h-3 w-3" />
        收藏夹
      </div>
      <ScrollArea className="max-h-48">
        <div className="space-y-0.5 px-1">
          {favorites.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 text-sm rounded-md',
                'hover:bg-accent hover:text-accent-foreground',
                'truncate',
              )}
            >
              {doc.isPinned && (
                <span className="text-primary shrink-0">📌</span>
              )}
              <span className="truncate">{doc.title}</span>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

---

## 6. 共享类型定义

```typescript
// packages/shared/src/types/batch.ts

// ============================================
// 批量操作
// ============================================

export interface BatchOperationRequest {
  documentIds: string[];
}

export interface BatchMoveRequest extends BatchOperationRequest {
  folderId?: string | null;
}

export interface BatchTagRequest extends BatchOperationRequest {
  tagIds: string[];
  mode: 'add' | 'remove' | 'replace';
}

export interface BatchResult {
  success: boolean;
  affected: number;
  errors?: string[];
}

// ============================================
// 收藏与置顶
// ============================================

export interface FavoriteDocument {
  id: string;
  title: string;
  isPinned: boolean;
  folder?: { id: string; name: string } | null;
  updatedAt: string;
}

export interface ToggleFavoriteResponse {
  isFavorite: boolean;
}

export interface TogglePinResponse {
  isPinned: boolean;
}
```

---

## 7. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/documents/batch-move` | 批量移动文档 |
| POST | `/api/documents/batch-tag` | 批量标签操作 |
| POST | `/api/documents/batch-archive` | 批量归档 |
| POST | `/api/documents/batch-restore` | 批量恢复 |
| POST | `/api/documents/batch-delete` | 批量永久删除 |
| GET | `/api/documents/favorites` | 获取收藏列表 |
| PATCH | `/api/documents/:id/favorite` | 切换收藏状态 |
| PATCH | `/api/documents/:id/pin` | 切换文档置顶 |
| PATCH | `/api/folders/:id/pin` | 切换文件夹置顶 |

---

## 8. 文件产出清单

```
Phase 3-1a 总计：新增 12 文件，修改 4 文件

后端新增 (7 files):
├── src/modules/documents/
│   ├── documents-batch.service.ts
│   ├── documents-batch.controller.ts
│   └── dto/
│       ├── batch-operation.dto.ts
│       ├── batch-move.dto.ts
│       └── batch-tag.dto.ts
└── src/modules/favorites/
    ├── favorites.module.ts
    ├── favorites.service.ts
    └── favorites.controller.ts

后端修改 (2 files):
├── prisma/schema.prisma              # 添加 isFavorite, isPinned 字段
└── src/modules/documents/documents.module.ts

前端新增 (5 files):
├── components/documents/
│   ├── document-selector.tsx
│   ├── batch-actions-bar.tsx
│   └── favorite-button.tsx
├── components/layout/
│   └── favorites-sidebar.tsx
├── hooks/
│   └── use-batch-operations.ts
└── stores/
    └── selection-store.ts

前端修改 (1 file):
└── app/(main)/layout.tsx             # 添加收藏夹侧边栏

共享包新增 (1 file):
└── packages/shared/src/types/
    └── batch.ts

共享包修改 (1 file):
└── packages/shared/src/types/index.ts
```

---

## 9. 验证方案

### 9.1 后端验证

```bash
# 1. 数据库迁移
cd apps/api && npx prisma migrate dev --name add_favorites_pins

# 2. 测试批量移动
curl -X POST http://localhost:4000/api/documents/batch-move \
  -H "Content-Type: application/json" \
  -d '{"documentIds":["uuid1","uuid2"],"folderId":"target-folder-id"}'

# 3. 测试批量归档
curl -X POST http://localhost:4000/api/documents/batch-archive \
  -H "Content-Type: application/json" \
  -d '{"documentIds":["uuid1","uuid2"]}'

# 4. 测试收藏切换
curl -X PATCH http://localhost:4000/api/documents/uuid/favorite

# 5. 测试置顶切换
curl -X PATCH http://localhost:4000/api/documents/uuid/pin

# 6. 获取收藏列表
curl http://localhost:4000/api/documents/favorites
```

### 9.2 前端验证

```bash
# 启动前端
cd apps/web && npx next dev

# 测试项目
# 1. 文档列表多选功能
# 2. 批量操作栏显示和操作
# 3. 收藏按钮切换
# 4. 置顶按钮切换
# 5. 收藏夹侧边栏显示
```

---

## 10. 完成标准

- [ ] 数据库字段添加成功（isFavorite, isPinned）
- [ ] 批量移动 API 可用
- [ ] 批量标签 API 可用（add/remove/replace 三种模式）
- [ ] 批量归档/恢复/删除 API 可用
- [ ] 收藏切换 API 可用
- [ ] 置顶切换 API 可用（文档和文件夹）
- [ ] 前端多选 UI 正常工作
- [ ] 批量操作栏显示和操作正常
- [ ] 收藏夹侧边栏显示收藏文档
- [ ] Swagger 文档更新
