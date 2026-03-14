# Phase 3-3 Spec: 知识图谱

## 1. 目标

实现知识图谱可视化功能，直观展示文档间的链接关系和标签关联，支持导出图片。同时实现最近文档快速访问功能。完成后：

- 知识图谱可视化展示文档关系
- 支持缩放、拖拽、节点交互
- 可导出为 PNG/SVG 图片
- 最近文档快速访问功能

---

## 2. 前置条件

- [x] Phase 3-2 完成（双向链接）
- [x] 文档和标签数据可用
- [x] React Flow 依赖已安装

---

## 3. 数据库设计

### 3.1 新增访问记录表

```sql
-- 文档访问记录表
CREATE TABLE "document_visits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "visited_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_visits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_visits_document_id_fkey"
        FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE
);

-- 索引
CREATE INDEX "document_visits_document_id_idx" ON "document_visits"("document_id");
CREATE INDEX "document_visits_visited_at_idx" ON "document_visits"("visited_at" DESC);
```

### 3.2 Prisma Schema

```prisma
// apps/api/prisma/schema.prisma

/// 文档访问记录
model DocumentVisit {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  documentId String   @map("document_id") @db.Uuid
  visitedAt  DateTime @default(now()) @map("visited_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([visitedAt(sort: Desc)])
  @@map("document_visits")
}

// 更新 Document 模型
model Document {
  // ... 原有字段

  // Phase 3-3 新增关联
  visits DocumentVisit[]
}
```

---

## 4. 后端实现

### 4.1 目录结构

```
apps/api/src/modules/
├── graph/
│   ├── graph.module.ts
│   ├── graph.service.ts
│   └── graph.controller.ts
└── documents/
    └── visit.service.ts            # 访问记录服务
```

### 4.2 图谱服务

```typescript
// apps/api/src/modules/graph/graph.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface GraphNode {
  id: string;
  type: 'document' | 'tag';
  label: string;
  data: {
    folderId?: string;
    folderName?: string;
    color?: string;
    docCount?: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'link' | 'tag';
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取完整图谱数据
   */
  async getGraphData(params?: {
    folderId?: string;
    tagIds?: string[];
    limit?: number;
  }): Promise<GraphData> {
    const { folderId, tagIds, limit = 100 } = params || {};

    // 构建文档查询条件
    const where: any = { isArchived: false };

    if (folderId) {
      where.folderId = folderId;
    }

    if (tagIds && tagIds.length > 0) {
      where.tags = { some: { tagId: { in: tagIds } } };
    }

    // 获取文档
    const documents = await this.prisma.document.findMany({
      where,
      take: limit,
      select: {
        id: true,
        title: true,
        folderId: true,
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
        sourceLinks: {
          select: { targetDocId: true },
        },
        targetLinks: {
          select: { sourceDocId: true },
        },
      },
    });

    // 获取所有标签
    const tags = await this.prisma.tag.findMany({
      where: {
        documents: {
          some: {
            document: { isArchived: false },
          },
        },
      },
      include: {
        _count: { select: { documents: true } },
      },
    });

    // 构建节点
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const addedEdges = new Set<string>();

    // 添加文档节点
    for (const doc of documents) {
      nodes.push({
        id: doc.id,
        type: 'document',
        label: doc.title,
        data: {
          folderId: doc.folderId || undefined,
          folderName: doc.folder?.name || undefined,
        },
      });

      // 添加文档-标签边
      for (const dt of doc.tags) {
        const edgeId = `${doc.id}-tag-${dt.tagId}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: doc.id,
            target: dt.tagId,
            type: 'tag',
          });
          addedEdges.add(edgeId);
        }
      }

      // 添加文档链接边
      for (const link of doc.sourceLinks) {
        const edgeId = `${doc.id}-link-${link.targetDocId}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: doc.id,
            target: link.targetDocId,
            type: 'link',
          });
          addedEdges.add(edgeId);
        }
      }
    }

    // 添加标签节点
    for (const tag of tags) {
      nodes.push({
        id: tag.id,
        type: 'tag',
        label: tag.name,
        data: {
          color: tag.color,
          docCount: tag._count.documents,
        },
      });
    }

    return { nodes, edges };
  }

  /**
   * 获取文档的局部图谱（以某文档为中心）
   */
  async getDocumentGraph(documentId: string, depth = 2): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const visitedDocs = new Set<string>();
    const addedEdges = new Set<string>();

    // 递归获取关联文档
    const fetchRelatedDocs = async (docId: string, currentDepth: number) => {
      if (currentDepth > depth || visitedDocs.has(docId)) return;
      visitedDocs.add(docId);

      const doc = await this.prisma.document.findUnique({
        where: { id: docId },
        select: {
          id: true,
          title: true,
          folder: { select: { name: true } },
          tags: { include: { tag: true } },
          sourceLinks: { select: { targetDocId: true } },
          targetLinks: { select: { sourceDocId: true } },
        },
      });

      if (!doc) return;

      // 添加文档节点
      if (!nodes.find((n) => n.id === doc.id)) {
        nodes.push({
          id: doc.id,
          type: 'document',
          label: doc.title,
          data: { folderName: doc.folder?.name },
        });
      }

      // 添加标签节点和边
      for (const dt of doc.tags) {
        if (!nodes.find((n) => n.id === dt.tagId)) {
          nodes.push({
            id: dt.tagId,
            type: 'tag',
            label: dt.tag.name,
            data: { color: dt.tag.color },
          });
        }

        const edgeId = `${doc.id}-tag-${dt.tagId}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: doc.id,
            target: dt.tagId,
            type: 'tag',
          });
          addedEdges.add(edgeId);
        }
      }

      // 添加链接边并递归获取
      for (const link of doc.sourceLinks) {
        const edgeId = `${doc.id}-link-${link.targetDocId}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: doc.id,
            target: link.targetDocId,
            type: 'link',
          });
          addedEdges.add(edgeId);
        }
        await fetchRelatedDocs(link.targetDocId, currentDepth + 1);
      }

      for (const link of doc.targetLinks) {
        const edgeId = `${link.sourceDocId}-link-${doc.id}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: link.sourceDocId,
            target: doc.id,
            type: 'link',
          });
          addedEdges.add(edgeId);
        }
        await fetchRelatedDocs(link.sourceDocId, currentDepth + 1);
      }
    };

    await fetchRelatedDocs(documentId, 1);

    return { nodes, edges };
  }
}
```

### 4.3 访问记录服务

```typescript
// apps/api/src/modules/documents/visit.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VisitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录文档访问
   */
  async recordVisit(documentId: string): Promise<void> {
    await this.prisma.documentVisit.create({
      data: { documentId },
    });
  }

  /**
   * 获取最近访问的文档
   */
  async getRecentDocuments(limit = 10) {
    // 获取最近的访问记录（去重）
    const visits = await this.prisma.$queryRaw<{ document_id: string }[]>`
      SELECT DISTINCT ON (document_id) document_id
      FROM document_visits
      ORDER BY document_id, visited_at DESC
      LIMIT ${limit}
    `;

    const docIds = visits.map((v) => v.document_id);

    if (docIds.length === 0) {
      return [];
    }

    // 获取文档详情
    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: docIds },
        isArchived: false,
      },
      select: {
        id: true,
        title: true,
        folder: { select: { id: true, name: true } },
        updatedAt: true,
      },
    });

    // 按访问顺序排序
    const docMap = new Map(documents.map((d) => [d.id, d]));
    return docIds
      .map((id) => docMap.get(id))
      .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined);
  }

  /**
   * 清除访问历史
   */
  async clearHistory(): Promise<void> {
    await this.prisma.documentVisit.deleteMany();
  }
}
```

### 4.4 控制器

```typescript
// apps/api/src/modules/graph/graph.controller.ts

import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GraphService } from './graph.service';

@ApiTags('知识图谱')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  @ApiOperation({ summary: '获取完整图谱数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getGraphData(
    @Query('folderId') folderId?: string,
    @Query('tagIds') tagIds?: string,
    @Query('limit') limit?: number,
  ) {
    return this.graphService.getGraphData({
      folderId,
      tagIds: tagIds?.split(','),
      limit: limit ? parseInt(String(limit), 10) : 100,
    });
  }

  @Get('document/:id')
  @ApiOperation({ summary: '获取文档局部图谱' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDocumentGraph(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('depth') depth?: number,
  ) {
    return this.graphService.getDocumentGraph(
      id,
      depth ? parseInt(String(depth), 10) : 2,
    );
  }
}
```

```typescript
// apps/api/src/modules/documents/documents.controller.ts 新增端点

@Get('recent')
@ApiOperation({ summary: '获取最近访问的文档' })
async getRecentDocuments(@Query('limit') limit?: number) {
  return this.visitService.getRecentDocuments(limit);
}

@Post(':id/visit')
@ApiOperation({ summary: '记录文档访问' })
async recordVisit(@Param('id', ParseUUIDPipe) id: string) {
  await this.visitService.recordVisit(id);
  return { success: true };
}

@Delete('visits')
@ApiOperation({ summary: '清除访问历史' })
async clearHistory() {
  await this.visitService.clearHistory();
  return { success: true };
}
```

---

## 5. 前端实现

### 5.1 安装依赖

```bash
cd apps/web
pnpm add @xyflow/react html-to-image
```

### 5.2 目录结构

```
apps/web/
├── components/graph/
│   ├── knowledge-graph.tsx        # 图谱主组件
│   ├── graph-node.tsx             # 自定义节点
│   ├── graph-edge.tsx             # 自定义边
│   ├── graph-controls.tsx         # 控制面板
│   └── graph-export.tsx           # 导出功能
├── components/layout/
│   └── recent-documents.tsx       # 最近文档组件
└── hooks/
    └── use-graph.ts               # 图谱 Hook
```

### 5.3 图谱 Hook

```typescript
// apps/web/hooks/use-graph.ts

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface GraphNode {
  id: string;
  type: 'document' | 'tag';
  label: string;
  data: {
    folderId?: string;
    folderName?: string;
    color?: string;
    docCount?: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'link' | 'tag';
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function useGraph() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchGraphData = useCallback(
    async (params?: { folderId?: string; tagIds?: string[]; limit?: number }) => {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (params?.folderId) searchParams.append('folderId', params.folderId);
        if (params?.tagIds) searchParams.append('tagIds', params.tagIds.join(','));
        if (params?.limit) searchParams.append('limit', String(params.limit));

        const response = await apiClient.get<GraphData>(
          `/graph?${searchParams.toString()}`,
        );
        return response.data;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const fetchDocumentGraph = useCallback(
    async (documentId: string, depth = 2) => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<GraphData>(
          `/graph/document/${documentId}?depth=${depth}`,
        );
        return response.data;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    isLoading,
    fetchGraphData,
    fetchDocumentGraph,
  };
}
```

### 5.4 知识图谱主组件

```typescript
// apps/web/components/graph/knowledge-graph.tsx

'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { DocumentNode } from './graph-node';
import { TagEdge } from './graph-edge';
import { GraphControls } from './graph-controls';
import { useGraph, GraphData, GraphNode as GNode, GraphEdge as GEdge } from '@/hooks/use-graph';
import dagre from 'dagre';

// 自定义节点类型
const nodeTypes = {
  document: DocumentNode,
  tag: DocumentNode, // 使用相同样式
};

// 自定义边类型
const edgeTypes = {
  link: TagEdge,
  tag: TagEdge,
};

// Dagre 布局配置
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

interface KnowledgeGraphProps {
  folderId?: string;
  tagIds?: string[];
  onNodeClick?: (nodeId: string, type: 'document' | 'tag') => void;
}

export function KnowledgeGraph({
  folderId,
  tagIds,
  onNodeClick,
}: KnowledgeGraphProps) {
  const { isLoading, fetchGraphData } = useGraph();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');

  // 转换数据格式
  const convertToReactFlow = useCallback(
    (data: GraphData) => {
      const rfNodes: Node[] = data.nodes.map((node: GNode) => ({
        id: node.id,
        type: node.type,
        data: {
          label: node.label,
          ...node.data,
        },
        position: { x: 0, y: 0 },
      }));

      const rfEdges: Edge[] = data.edges.map((edge: GEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        animated: edge.type === 'link',
        style: edge.type === 'tag' ? { stroke: '#94a3b8' } : { stroke: '#3b82f6' },
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        rfNodes,
        rfEdges,
        layoutDirection,
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [layoutDirection, setNodes, setEdges],
  );

  // 加载数据
  const loadData = useCallback(async () => {
    const data = await fetchGraphData({ folderId, tagIds });
    convertToReactFlow(data);
  }, [fetchGraphData, folderId, tagIds, convertToReactFlow]);

  // 重新布局
  const relayout = useCallback(
    (direction: 'TB' | 'LR') => {
      setLayoutDirection(direction);
      const { nodes: layoutedNodes } = getLayoutedElements(
        nodes,
        edges,
        direction,
      );
      setNodes(layoutedNodes);
    },
    [nodes, edges, setNodes],
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id, node.type as 'document' | 'tag');
    },
    [onNodeClick],
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'tag') return '#94a3b8';
            return '#3b82f6';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>

      <GraphControls
        onRefresh={loadData}
        onRelayout={relayout}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### 5.5 自定义节点组件

```typescript
// apps/web/components/graph/graph-node.tsx

'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FileText, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentNodeData {
  label: string;
  folderName?: string;
  color?: string;
  docCount?: number;
}

export const DocumentNode = memo(({ data, type }: NodeProps<DocumentNodeData>) => {
  const isTag = type === 'tag';

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg border shadow-sm bg-background',
        'min-w-[120px] max-w-[200px]',
        'hover:shadow-md transition-shadow cursor-pointer',
        isTag && 'border-dashed',
      )}
      style={{
        borderColor: isTag ? data.color : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted" />
      <Handle type="source" position={Position.Bottom} className="!bg-muted" />

      <div className="flex items-center gap-2">
        {isTag ? (
          <Tag className="h-4 w-4 shrink-0" style={{ color: data.color }} />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{data.label}</div>
          {data.folderName && (
            <div className="text-xs text-muted-foreground truncate">
              {data.folderName}
            </div>
          )}
          {data.docCount !== undefined && (
            <div className="text-xs text-muted-foreground">
              {data.docCount} 篇文档
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DocumentNode.displayName = 'DocumentNode';
```

### 5.6 控制面板组件

```typescript
// apps/web/components/graph/graph-controls.tsx

'use client';

import { RefreshCw, Download, LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { exportToImage } from './graph-export';

interface GraphControlsProps {
  onRefresh: () => void;
  onRelayout: (direction: 'TB' | 'LR') => void;
  isLoading: boolean;
}

export function GraphControls({
  onRefresh,
  onRelayout,
  isLoading,
}: GraphControlsProps) {
  const handleExport = async () => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (element) {
      await exportToImage(element, 'knowledge-graph.png');
    }
  };

  return (
    <TooltipProvider>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onRelayout('TB')}
              disabled={isLoading}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>垂直布局</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onRelayout('LR')}
              disabled={isLoading}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>水平布局</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>刷新数据</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>导出图片</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
```

### 5.7 导出功能

```typescript
// apps/web/components/graph/graph-export.tsx

import { toPng, toSvg } from 'html-to-image';

export async function exportToImage(
  element: HTMLElement,
  filename: string,
  format: 'png' | 'svg' = 'png',
): Promise<void> {
  try {
    const dataUrl = format === 'png'
      ? await toPng(element, {
          backgroundColor: '#ffffff',
          quality: 1,
        })
      : await toSvg(element);

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

export async function exportToSvg(element: HTMLElement, filename: string): Promise<void> {
  return exportToImage(element, filename, 'svg');
}
```

### 5.8 最近文档组件

```typescript
// apps/web/components/layout/recent-documents.tsx

'use client';

import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface RecentDocument {
  id: string;
  title: string;
  folder?: { id: string; name: string } | null;
  updatedAt: string;
}

export function RecentDocuments() {
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    try {
      const response = await apiClient.get<RecentDocument[]>(
        '/documents/recent?limit=5',
      );
      setDocuments(response.data);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    await apiClient.delete('/documents/visits');
    setDocuments([]);
  };

  if (isLoading || documents.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" />
          最近访问
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="h-auto p-1"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="max-h-40">
        <div className="space-y-0.5 px-1">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="flex flex-col px-2 py-1.5 text-sm rounded-md hover:bg-accent"
            >
              <span className="truncate">{doc.title}</span>
              {doc.folder && (
                <span className="text-xs text-muted-foreground truncate">
                  {doc.folder.name}
                </span>
              )}
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
// packages/shared/src/types/graph.ts

export interface GraphNode {
  id: string;
  type: 'document' | 'tag';
  label: string;
  data: {
    folderId?: string;
    folderName?: string;
    color?: string;
    docCount?: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'link' | 'tag';
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphQueryParams {
  folderId?: string;
  tagIds?: string[];
  limit?: number;
}

export interface RecentDocument {
  id: string;
  title: string;
  folder?: { id: string; name: string } | null;
  updatedAt: string;
}
```

---

## 7. API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/graph` | 获取完整图谱数据 |
| GET | `/api/graph/document/:id` | 获取文档局部图谱 |
| GET | `/api/documents/recent` | 获取最近访问文档 |
| POST | `/api/documents/:id/visit` | 记录文档访问 |
| DELETE | `/api/documents/visits` | 清除访问历史 |

---

## 8. 文件产出清单

```
Phase 3-3 总计：新增 10 文件，修改 3 文件

后端新增 (4 files):
├── src/modules/graph/
│   ├── graph.module.ts
│   ├── graph.service.ts
│   └── graph.controller.ts
└── src/modules/documents/
    └── visit.service.ts

后端修改 (2 files):
├── prisma/schema.prisma              # 添加 DocumentVisit 模型
└── src/modules/documents/documents.controller.ts

前端新增 (7 files):
├── components/graph/
│   ├── knowledge-graph.tsx
│   ├── graph-node.tsx
│   ├── graph-edge.tsx
│   ├── graph-controls.tsx
│   └── graph-export.tsx
├── components/layout/
│   └── recent-documents.tsx
└── hooks/
    └── use-graph.ts

前端修改 (2 files):
├── app/(main)/layout.tsx             # 添加最近文档组件
└── app/(main)/graph/page.tsx         # 图谱页面（新建）

共享包新增 (1 file):
└── packages/shared/src/types/
    └── graph.ts
```

---

## 9. 验证方案

### 9.1 后端验证

```bash
# 1. 数据库迁移
cd apps/api && npx prisma migrate dev --name add_document_visits

# 2. 获取图谱数据
curl http://localhost:4000/api/graph

# 3. 记录文档访问
curl -X POST http://localhost:4000/api/documents/{id}/visit

# 4. 获取最近文档
curl http://localhost:4000/api/documents/recent
```

### 9.2 前端验证

```bash
# 安装依赖
cd apps/web && pnpm add @xyflow/react html-to-image dagre

# 启动前端
npx next dev

# 测试项目
# 1. 知识图谱显示
# 2. 节点拖拽和缩放
# 3. 布局切换
# 4. 导出图片
# 5. 最近文档显示
```

---

## 10. 完成标准

- [ ] `document_visits` 表创建成功
- [ ] 图谱数据 API 可用
- [ ] 文档局部图谱 API 可用
- [ ] 访问记录 API 可用
- [ ] 最近文档 API 可用
- [ ] 知识图谱组件渲染正常
- [ ] 节点交互（点击、拖拽）正常
- [ ] 布局切换功能可用
- [ ] 导出图片功能可用
- [ ] 最近文档组件显示正常
- [ ] Swagger 文档更新
