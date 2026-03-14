# Phase 3-2 Spec: 双向链接 + 增强

## 1. 目标

实现文档间的双向链接系统，以及文档大纲提取、搜索结果增强等功能，构建知识网络基础。完成后：

- 文档间可建立链接关系
- 自动提取和显示反向链接
- 文档目录大纲自动生成
- 搜索结果关键词高亮
- 高级筛选功能可用

---

## 2. 前置条件

- [x] Phase 1 完成（文档 CRUD）
- [x] Phase 2 完成（AI 对话）
- [x] 编辑器功能可用

---

## 3. 数据库设计

### 3.1 新增双向链接表

```sql
-- 双向链接表
CREATE TABLE "bi_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "source_doc_id" UUID NOT NULL,
    "target_doc_id" UUID NOT NULL,
    "link_text" VARCHAR(500),
    "position" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_links_source_doc_id_fkey"
        FOREIGN KEY ("source_doc_id") REFERENCES "documents"("id") ON DELETE CASCADE,
    CONSTRAINT "bi_links_target_doc_id_fkey"
        FOREIGN KEY ("target_doc_id") REFERENCES "documents"("id") ON DELETE CASCADE,
    CONSTRAINT "bi_links_unique"
        UNIQUE ("source_doc_id", "target_doc_id")
);

-- 索引
CREATE INDEX "bi_links_source_doc_id_idx" ON "bi_links"("source_doc_id");
CREATE INDEX "bi_links_target_doc_id_idx" ON "bi_links"("target_doc_id");
```

### 3.2 Prisma Schema

```prisma
// apps/api/prisma/schema.prisma

/// 双向链接
model BiLink {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  sourceDocId String   @map("source_doc_id") @db.Uuid
  targetDocId String   @map("target_doc_id") @db.Uuid
  linkText    String   @map("link_text") @db.VarChar(500)
  position    Json     @default("{}")  // { start: number, end: number }
  createdAt   DateTime @default(now()) @map("created_at")

  sourceDoc Document @relation("SourceLinks", fields: [sourceDocId], references: [id], onDelete: Cascade)
  targetDoc Document @relation("TargetLinks", fields: [targetDocId], references: [id], onDelete: Cascade)

  @@unique([sourceDocId, targetDocId])
  @@index([sourceDocId])
  @@index([targetDocId])
  @@map("bi_links")
}

// 更新 Document 模型
model Document {
  // ... 原有字段

  // Phase 3-2 新增关联
  sourceLinks BiLink[] @relation("SourceLinks")
  targetLinks BiLink[] @relation("TargetLinks")
}
```

---

## 4. 后端实现

### 4.1 目录结构

```
apps/api/src/modules/
├── links/
│   ├── links.module.ts
│   ├── links.service.ts
│   ├── links.controller.ts
│   └── dto/
│       └── create-link.dto.ts
├── documents/
│   └── outline.service.ts           # 大纲提取服务
└── search/
    └── search-enhanced.service.ts   # 增强搜索服务
```

### 4.2 链接 DTO

```typescript
// apps/api/src/modules/links/dto/create-link.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, MaxLength, IsOptional, IsObject } from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({ description: '源文档 ID' })
  @IsUUID('4')
  sourceDocId: string;

  @ApiProperty({ description: '目标文档 ID' })
  @IsUUID('4')
  targetDocId: string;

  @ApiPropertyOptional({ description: '链接显示文本' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkText?: string;

  @ApiPropertyOptional({ description: '链接位置信息' })
  @IsOptional()
  @IsObject()
  position?: { start: number; end: number };
}
```

### 4.3 链接服务

```typescript
// apps/api/src/modules/links/links.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLinkDto } from './dto/create-link.dto';

export interface LinkWithDocument {
  id: string;
  documentId: string;
  documentTitle: string;
  linkText: string;
  position: { start: number; end: number };
  createdAt: Date;
}

@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建链接
   */
  async create(dto: CreateLinkDto) {
    // 检查源文档和目标文档是否存在
    const [sourceDoc, targetDoc] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id: dto.sourceDocId },
        select: { id: true },
      }),
      this.prisma.document.findUnique({
        where: { id: dto.targetDocId },
        select: { id: true, title: true },
      }),
    ]);

    if (!sourceDoc) {
      throw new NotFoundException(`源文档 ${dto.sourceDocId} 不存在`);
    }
    if (!targetDoc) {
      throw new NotFoundException(`目标文档 ${dto.targetDocId} 不存在`);
    }

    // 检查链接是否已存在
    const existing = await this.prisma.biLink.findUnique({
      where: {
        sourceDocId_targetDocId: {
          sourceDocId: dto.sourceDocId,
          targetDocId: dto.targetDocId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('该链接已存在');
    }

    return this.prisma.biLink.create({
      data: {
        sourceDocId: dto.sourceDocId,
        targetDocId: dto.targetDocId,
        linkText: dto.linkText || targetDoc.title,
        position: dto.position || {},
      },
    });
  }

  /**
   * 获取文档的出站链接（当前文档链接到的其他文档）
   */
  async getOutboundLinks(documentId: string): Promise<LinkWithDocument[]> {
    const links = await this.prisma.biLink.findMany({
      where: { sourceDocId: documentId },
      include: {
        targetDoc: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id,
      documentId: link.targetDoc.id,
      documentTitle: link.targetDoc.title,
      linkText: link.linkText,
      position: link.position as { start: number; end: number },
      createdAt: link.createdAt,
    }));
  }

  /**
   * 获取文档的反向链接（其他文档链接到当前文档）
   */
  async getBacklinks(documentId: string): Promise<LinkWithDocument[]> {
    const links = await this.prisma.biLink.findMany({
      where: { targetDocId: documentId },
      include: {
        sourceDoc: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id,
      documentId: link.sourceDoc.id,
      documentTitle: link.sourceDoc.title,
      linkText: link.linkText,
      position: link.position as { start: number; end: number },
      createdAt: link.createdAt,
    }));
  }

  /**
   * 删除链接
   */
  async remove(id: string) {
    const link = await this.prisma.biLink.findUnique({
      where: { id },
    });

    if (!link) {
      throw new NotFoundException(`链接 ${id} 不存在`);
    }

    await this.prisma.biLink.delete({ where: { id } });
    return { id };
  }

  /**
   * 批量更新文档链接（解析文档内容并重建链接）
   */
  async updateDocumentLinks(documentId: string, content: string) {
    // 解析内容中的链接
    const links = this.parseLinks(content);

    // 删除现有链接
    await this.prisma.biLink.deleteMany({
      where: { sourceDocId: documentId },
    });

    // 创建新链接
    for (const link of links) {
      try {
        await this.prisma.biLink.create({
          data: {
            sourceDocId: documentId,
            targetDocId: link.targetDocId,
            linkText: link.linkText,
            position: link.position,
          },
        });
      } catch (error) {
        // 忽略目标文档不存在的错误
        this.logger.warn(`创建链接失败: ${error.message}`);
      }
    }

    return { count: links.length };
  }

  /**
   * 解析文档内容中的链接
   * 链接格式：<a data-doc-id="uuid">文本</a>
   */
  private parseLinks(
    content: string,
  ): Array<{ targetDocId: string; linkText: string; position: object }> {
    const links: Array<{ targetDocId: string; linkText: string; position: object }> = [];
    const regex = /<a[^>]*data-doc-id="([^"]+)"[^>]*>([^<]*)<\/a>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      links.push({
        targetDocId: match[1],
        linkText: match[2],
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    return links;
  }

  /**
   * 搜索文档标题（用于链接建议）
   */
  async searchDocuments(query: string, excludeId?: string) {
    const where: any = {
      isArchived: false,
    };

    if (query) {
      where.title = {
        contains: query,
        mode: 'insensitive',
      };
    }

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return this.prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        folder: { select: { name: true } },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });
  }
}
```

### 4.4 大纲服务

```typescript
// apps/api/src/modules/documents/outline.service.ts

import { Injectable } from '@nestjs/common';

export interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  children: OutlineItem[];
}

@Injectable()
export class OutlineService {
  /**
   * 从 Markdown 内容提取目录大纲
   */
  extractOutline(content: string): OutlineItem[] {
    const lines = content.split('\n');
    const headings: Array<{ level: number; text: string; slug: string }> = [];

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const slug = this.generateSlug(text);
        headings.push({ level, text, slug });
      }
    }

    return this.buildTree(headings);
  }

  /**
   * 将扁平标题列表构建为树形结构
   */
  private buildTree(
    headings: Array<{ level: number; text: string; slug: string }>,
  ): OutlineItem[] {
    const root: OutlineItem[] = [];
    const stack: OutlineItem[] = [];

    for (const heading of headings) {
      const item: OutlineItem = {
        level: heading.level,
        text: heading.text,
        slug: heading.slug,
        children: [],
      };

      // 找到合适的父节点
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].children.push(item);
      }

      stack.push(item);
    }

    return root;
  }

  /**
   * 生成标题的 slug
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
```

### 4.5 增强搜索服务

```typescript
// apps/api/src/modules/search/search-enhanced.service.ts

import { Injectable } from '@nestjs/common';
import { MeiliService } from './meili.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface EnhancedSearchResult {
  id: string;
  title: string;
  highlights: Array<{
    field: string;
    snippet: string;
  }>;
  folder?: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  updatedAt: string;
}

export interface SearchParams {
  query: string;
  folderId?: string;
  tagIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchEnhancedService {
  constructor(
    private readonly meiliService: MeiliService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 增强搜索（带高亮和筛选）
   */
  async search(params: SearchParams) {
    const {
      query,
      folderId,
      tagIds,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = params;

    // 构建 Meilisearch 筛选条件
    const filter: string[] = ['isArchived = false'];

    if (folderId) {
      filter.push(`folderId = "${folderId}"`);
    }

    if (tagIds && tagIds.length > 0) {
      const tagFilters = tagIds.map((id) => `tagIds = "${id}"`);
      filter.push(`(${tagFilters.join(' OR ')})`);
    }

    if (dateFrom) {
      filter.push(`updatedAt >= "${dateFrom}"`);
    }

    if (dateTo) {
      filter.push(`updatedAt <= "${dateTo}"`);
    }

    // 执行搜索
    const searchResult = await this.meiliService.search('documents', query, {
      filter: filter.join(' AND '),
      attributesToHighlight: ['title', 'contentPlain'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      offset: (page - 1) * limit,
      limit,
    });

    // 获取文档详情
    const docIds = searchResult.hits.map((hit: any) => hit.id);
    const documents = await this.prisma.document.findMany({
      where: { id: { in: docIds } },
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    const docMap = new Map(documents.map((doc) => [doc.id, doc]));

    // 组装结果
    const items: EnhancedSearchResult[] = searchResult.hits.map((hit: any) => {
      const doc = docMap.get(hit.id);
      const formattedHit = hit._formatted || {};

      return {
        id: hit.id,
        title: formattedHit.title || hit.title,
        highlights: [
          {
            field: 'title',
            snippet: formattedHit.title || hit.title,
          },
          {
            field: 'content',
            snippet: this.truncateSnippet(
              formattedHit.contentPlain || hit.contentPlain || '',
              200,
            ),
          },
        ],
        folder: doc?.folder || null,
        tags: doc?.tags.map((t) => ({
          id: t.tag.id,
          name: t.tag.name,
          color: t.tag.color,
        })) || [],
        updatedAt: hit.updatedAt,
      };
    });

    return {
      items,
      total: searchResult.estimatedTotalHits,
      page,
      limit,
      query,
    };
  }

  /**
   * 截取摘要
   */
  private truncateSnippet(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
}
```

### 4.6 控制器

```typescript
// apps/api/src/modules/links/links.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';

@ApiTags('双向链接')
@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get('documents/:id/links')
  @ApiOperation({ summary: '获取文档的出站链接' })
  async getOutboundLinks(@Param('id', ParseUUIDPipe) id: string) {
    return this.linksService.getOutboundLinks(id);
  }

  @Get('documents/:id/backlinks')
  @ApiOperation({ summary: '获取文档的反向链接' })
  async getBacklinks(@Param('id', ParseUUIDPipe) id: string) {
    return this.linksService.getBacklinks(id);
  }

  @Post('links')
  @ApiOperation({ summary: '创建链接' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(@Body() dto: CreateLinkDto) {
    return this.linksService.create(dto);
  }

  @Delete('links/:id')
  @ApiOperation({ summary: '删除链接' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.linksService.remove(id);
  }

  @Get('links/suggest')
  @ApiOperation({ summary: '搜索文档标题（用于链接建议）' })
  async suggest(
    @Query('q') query: string,
    @Query('exclude') excludeId?: string,
  ) {
    return this.linksService.searchDocuments(query, excludeId);
  }
}
```

```typescript
// apps/api/src/modules/documents/documents.controller.ts 新增端点

@Get(':id/outline')
@ApiOperation({ summary: '获取文档目录大纲' })
async getOutline(@Param('id', ParseUUIDPipe) id: string) {
  const doc = await this.documentsService.findOne(id);
  return this.outlineService.extractOutline(doc.content);
}
```

```typescript
// apps/api/src/modules/search/search.controller.ts 新增端点

@Get('enhanced')
@ApiOperation({ summary: '增强搜索（带高亮和筛选）' })
async enhancedSearch(@Query() params: EnhancedSearchParams) {
  return this.searchEnhancedService.search(params);
}
```

---

## 5. 前端实现

### 5.1 目录结构

```
apps/web/
├── components/links/
│   ├── link-suggest.tsx           # 链接建议弹窗
│   ├── backlinks-panel.tsx        # 反向链接面板
│   ├── outbound-links.tsx         # 出站链接列表
│   └── link-preview-card.tsx      # 链接预览卡片
├── components/documents/
│   ├── document-outline.tsx       # 文档大纲
│   └── search-highlight.tsx       # 搜索高亮组件
├── components/search/
│   └── advanced-filter.tsx        # 高级筛选
└── hooks/
    └── use-links.ts               # 链接 Hook
```

### 5.2 链接 Hook

```typescript
// apps/web/hooks/use-links.ts

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Link {
  id: string;
  documentId: string;
  documentTitle: string;
  linkText: string;
  position: { start: number; end: number };
  createdAt: string;
}

export interface LinkSuggestion {
  id: string;
  title: string;
  folder?: { name: string } | null;
}

export function useLinks() {
  const [isLoading, setIsLoading] = useState(false);

  const getOutboundLinks = useCallback(async (documentId: string) => {
    const response = await apiClient.get<Link[]>(
      `/documents/${documentId}/links`,
    );
    return response.data;
  }, []);

  const getBacklinks = useCallback(async (documentId: string) => {
    const response = await apiClient.get<Link[]>(
      `/documents/${documentId}/backlinks`,
    );
    return response.data;
  }, []);

  const createLink = useCallback(
    async (data: {
      sourceDocId: string;
      targetDocId: string;
      linkText?: string;
      position?: { start: number; end: number };
    }) => {
      const response = await apiClient.post('/links', data);
      return response.data;
    },
    [],
  );

  const deleteLink = useCallback(async (id: string) => {
    await apiClient.delete(`/links/${id}`);
  }, []);

  const suggestDocuments = useCallback(
    async (query: string, excludeId?: string) => {
      const params = new URLSearchParams({ q: query });
      if (excludeId) params.append('exclude', excludeId);

      const response = await apiClient.get<LinkSuggestion[]>(
        `/links/suggest?${params.toString()}`,
      );
      return response.data;
    },
    [],
  );

  return {
    isLoading,
    getOutboundLinks,
    getBacklinks,
    createLink,
    deleteLink,
    suggestDocuments,
  };
}
```

### 5.3 链接建议组件

```typescript
// apps/web/components/links/link-suggest.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLinks, LinkSuggestion } from '@/hooks/use-links';
import { cn } from '@/lib/utils';

interface LinkSuggestProps {
  open: boolean;
  position: { x: number; y: number };
  excludeId?: string;
  onSelect: (doc: LinkSuggestion) => void;
  onClose: () => void;
}

export function LinkSuggest({
  open,
  position,
  excludeId,
  onSelect,
  onClose,
}: LinkSuggestProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { suggestDocuments } = useLinks();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSuggestions([]);
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await suggestDocuments(query, excludeId);
      setSuggestions(results);
      setSelectedIndex(0);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, excludeId, suggestDocuments]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, suggestions, selectedIndex, onSelect, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed z-50 bg-popover border rounded-lg shadow-lg w-72"
      style={{ left: position.x, top: position.y }}
    >
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档..."
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="max-h-64">
        {suggestions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {query ? '未找到匹配文档' : '输入关键词搜索文档'}
          </div>
        ) : (
          <div className="p-1">
            {suggestions.map((doc, index) => (
              <button
                key={doc.id}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm',
                  'hover:bg-accent',
                  index === selectedIndex && 'bg-accent',
                )}
                onClick={() => onSelect(doc)}
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 truncate">
                  <div className="truncate">{doc.title}</div>
                  {doc.folder && (
                    <div className="text-xs text-muted-foreground truncate">
                      {doc.folder.name}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

### 5.4 反向链接面板

```typescript
// apps/web/components/links/backlinks-panel.tsx

'use client';

import { useEffect, useState } from 'react';
import { Link2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useLinks, Link as LinkType } from '@/hooks/use-links';

interface BacklinksPanelProps {
  documentId: string;
}

export function BacklinksPanel({ documentId }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<LinkType[]>([]);
  const [outboundLinks, setOutboundLinks] = useState<LinkType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getBacklinks, getOutboundLinks } = useLinks();

  useEffect(() => {
    const fetchLinks = async () => {
      setIsLoading(true);
      try {
        const [back, out] = await Promise.all([
          getBacklinks(documentId),
          getOutboundLinks(documentId),
        ]);
        setBacklinks(back);
        setOutboundLinks(out);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinks();
  }, [documentId, getBacklinks, getOutboundLinks]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="border-t">
      {/* 出站链接 */}
      {outboundLinks.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Link2 className="h-4 w-4" />
            链接到 ({outboundLinks.length})
          </h4>
          <ScrollArea className="max-h-32">
            <div className="space-y-1">
              {outboundLinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/documents/${link.documentId}`}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <span className="truncate">{link.documentTitle}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* 反向链接 */}
      {backlinks.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Link2 className="h-4 w-4 rotate-180" />
            被引用 ({backlinks.length})
          </h4>
          <ScrollArea className="max-h-32">
            <div className="space-y-1">
              {backlinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/documents/${link.documentId}`}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <span className="truncate">{link.documentTitle}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {outboundLinks.length === 0 && backlinks.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          暂无链接
        </div>
      )}
    </div>
  );
}
```

### 5.5 文档大纲组件

```typescript
// apps/web/components/documents/document-outline.tsx

'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  children: OutlineItem[];
}

interface DocumentOutlineProps {
  documentId: string;
  onHeadingClick?: (slug: string) => void;
}

export function DocumentOutline({
  documentId,
  onHeadingClick,
}: DocumentOutlineProps) {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeSlug, setActiveSlug] = useState<string>('');

  useEffect(() => {
    const fetchOutline = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/outline`,
        );
        const data = await response.json();
        setOutline(data);
      } catch (error) {
        console.error('Failed to fetch outline', error);
      }
    };

    fetchOutline();
  }, [documentId]);

  const toggleExpand = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const renderItems = (items: OutlineItem[], depth = 0) => {
    return items.map((item) => {
      const hasChildren = item.children.length > 0;
      const isExpanded = expanded.has(item.slug);

      return (
        <div key={item.slug}>
          <div
            className={cn(
              'flex items-center gap-1 py-1 px-2 text-sm cursor-pointer',
              'hover:bg-accent rounded',
              activeSlug === item.slug && 'bg-accent text-primary',
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onHeadingClick?.(item.slug)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(item.slug);
                }}
                className="p-0.5 hover:bg-accent-foreground/10 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            )}
            {!hasChildren && <span className="w-4" />}
            <span className="truncate">{item.text}</span>
          </div>

          {hasChildren && isExpanded && renderItems(item.children, depth + 1)}
        </div>
      );
    });
  };

  if (outline.length === 0) return null;

  return (
    <div className="py-2">
      <h4 className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
        目录
      </h4>
      <ScrollArea className="max-h-64">{renderItems(outline)}</ScrollArea>
    </div>
  );
}
```

### 5.6 高级筛选组件

```typescript
// apps/web/components/search/advanced-filter.tsx

'use client';

import { useState } from 'react';
import { Filter, X, Calendar, Tag, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AdvancedFilterProps {
  folders: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string; color: string }>;
  filters: {
    folderId?: string;
    tagIds?: string[];
    dateFrom?: string;
    dateTo?: string;
  };
  onFiltersChange: (filters: AdvancedFilterProps['filters']) => void;
}

export function AdvancedFilter({
  folders,
  tags,
  filters,
  onFiltersChange,
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters =
    filters.folderId ||
    (filters.tagIds && filters.tagIds.length > 0) ||
    filters.dateFrom ||
    filters.dateTo;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          高级筛选
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">筛选条件</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-auto p-1 text-xs"
              >
                清除
              </Button>
            )}
          </div>

          {/* 文件夹筛选 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Folder className="h-4 w-4" />
              文件夹
            </Label>
            <Select
              value={filters.folderId || 'all'}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  folderId: value === 'all' ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="全部文件夹" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部文件夹</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 标签筛选 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              标签
            </Label>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    const currentIds = filters.tagIds || [];
                    const newIds = currentIds.includes(tag.id)
                      ? currentIds.filter((id) => id !== tag.id)
                      : [...currentIds, tag.id];
                    onFiltersChange({ ...filters, tagIds: newIds });
                  }}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    filters.tagIds?.includes(tag.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent'
                  }`}
                  style={{
                    borderColor: filters.tagIds?.includes(tag.id)
                      ? undefined
                      : tag.color,
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* 日期范围 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              更新时间
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, dateFrom: e.target.value })
                }
                placeholder="开始日期"
              />
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, dateTo: e.target.value })
                }
                placeholder="结束日期"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 6. 共享类型定义

```typescript
// packages/shared/src/types/link.ts

export interface BiLink {
  id: string;
  sourceDocId: string;
  targetDocId: string;
  linkText: string;
  position: { start: number; end: number };
  createdAt: string;
}

export interface LinkWithDocument {
  id: string;
  documentId: string;
  documentTitle: string;
  linkText: string;
  position: { start: number; end: number };
  createdAt: string;
}

export interface CreateLinkRequest {
  sourceDocId: string;
  targetDocId: string;
  linkText?: string;
  position?: { start: number; end: number };
}

export interface LinkSuggestion {
  id: string;
  title: string;
  folder?: { name: string } | null;
}

export interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  children: OutlineItem[];
}
```

---

## 7. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/documents/:id/links` | 获取出站链接 |
| GET | `/api/documents/:id/backlinks` | 获取反向链接 |
| GET | `/api/documents/:id/outline` | 获取文档大纲 |
| POST | `/api/links` | 创建链接 |
| DELETE | `/api/links/:id` | 删除链接 |
| GET | `/api/links/suggest` | 搜索文档标题 |
| GET | `/api/search/enhanced` | 增强搜索 |

---

## 8. 文件产出清单

```
Phase 3-2 总计：新增 16 文件，修改 4 文件

后端新增 (8 files):
├── src/modules/links/
│   ├── links.module.ts
│   ├── links.service.ts
│   ├── links.controller.ts
│   └── dto/
│       └── create-link.dto.ts
├── src/modules/documents/
│   └── outline.service.ts
└── src/modules/search/
    └── search-enhanced.service.ts

后端修改 (2 files):
├── prisma/schema.prisma              # 添加 BiLink 模型
├── src/modules/documents/documents.controller.ts
└── src/modules/search/search.controller.ts

前端新增 (8 files):
├── components/links/
│   ├── link-suggest.tsx
│   ├── backlinks-panel.tsx
│   ├── outbound-links.tsx
│   └── link-preview-card.tsx
├── components/documents/
│   ├── document-outline.tsx
│   └── search-highlight.tsx
├── components/search/
│   └── advanced-filter.tsx
└── hooks/
    └── use-links.ts

前端修改 (2 files):
├── app/(main)/documents/[id]/page.tsx
└── app/(main)/search/page.tsx

共享包新增 (1 file):
└── packages/shared/src/types/
    └── link.ts
```

---

## 9. 验证方案

### 9.1 后端验证

```bash
# 1. 数据库迁移
cd apps/api && npx prisma migrate dev --name add_bi_links

# 2. 创建链接
curl -X POST http://localhost:4000/api/links \
  -H "Content-Type: application/json" \
  -d '{"sourceDocId":"uuid1","targetDocId":"uuid2","linkText":"相关文档"}'

# 3. 获取出站链接
curl http://localhost:4000/api/documents/uuid1/links

# 4. 获取反向链接
curl http://localhost:4000/api/documents/uuid2/backlinks

# 5. 获取大纲
curl http://localhost:4000/api/documents/uuid/outline

# 6. 增强搜索
curl "http://localhost:4000/api/search/enhanced?query=test&folderId=xxx"
```

### 9.2 前端验证

```bash
# 启动前端
cd apps/web && npx next dev

# 测试项目
# 1. 文档编辑时创建链接
# 2. 链接建议弹窗显示
# 3. 反向链接面板显示
# 4. 文档大纲显示
# 5. 搜索结果高亮
# 6. 高级筛选功能
```

---

## 10. 完成标准

- [ ] `bi_links` 表创建成功
- [ ] 链接创建/删除 API 可用
- [ ] 出站链接/反向链接查询 API 可用
- [ ] 文档大纲提取 API 可用
- [ ] 增强搜索 API 可用（高亮、筛选）
- [ ] 链接建议组件可用
- [ ] 反向链接面板显示正常
- [ ] 文档大纲组件显示正常
- [ ] 高级筛选组件可用
- [ ] Swagger 文档更新
