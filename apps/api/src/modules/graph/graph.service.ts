import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetGraphDataDto } from './dto/graph.dto';

export interface GraphNode {
  id: string;
  type: string;
  data: {
    label: string;
    folder?: string;
    tags: string[];
    isFavorite: boolean;
    isPinned: boolean;
    wordCount: number;
    updatedAt: string;
  };
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    isolatedNodes: number;
    connectedComponents: number;
  };
}

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取完整知识图谱数据
   */
  async getFullGraph(dto: GetGraphDataDto): Promise<GraphData> {
    const maxNodes = dto.maxNodes || 50;

    // 获取文档
    const documents = await this.prisma.document.findMany({
      where: {
        isArchived: false,
        ...(dto.folderId && { folderId: dto.folderId }),
        ...(dto.tagId && {
          tags: { some: { tagId: dto.tagId } },
        }),
      },
      include: {
        folder: { select: { name: true } },
        tags: {
          include: { tag: { select: { name: true } } },
        },
      },
      take: maxNodes,
      orderBy: { updatedAt: 'desc' },
    });

    // 获取链接关系
    const docIds = documents.map((d) => d.id);
    const links = await this.prisma.biLink.findMany({
      where: {
        OR: [{ sourceDocId: { in: docIds } }, { targetDocId: { in: docIds } }],
      },
    });

    return this.buildGraphData(documents, links);
  }

  /**
   * 获取局部图谱（以某个文档为中心）
   */
  async getLocalGraph(centerDocId: string, dto: GetGraphDataDto): Promise<GraphData> {
    const depth = dto.depth || 2;
    const maxNodes = dto.maxNodes || 50;

    // 收集所有相关文档ID
    const collectedIds = new Set<string>([centerDocId]);
    const collectedLinks = new Set<string>();

    // BFS 遍历收集节点
    let currentLevel = [centerDocId];
    for (let i = 0; i < depth && currentLevel.length > 0; i++) {
      const links = await this.prisma.biLink.findMany({
        where: {
          OR: [
            { sourceDocId: { in: currentLevel } },
            { targetDocId: { in: currentLevel } },
          ],
        },
      });

      currentLevel = [];
      for (const link of links) {
        if (!collectedLinks.has(link.id)) {
          collectedLinks.add(link.id);
        }
        if (!collectedIds.has(link.sourceDocId)) {
          collectedIds.add(link.sourceDocId);
          currentLevel.push(link.sourceDocId);
        }
        if (!collectedIds.has(link.targetDocId)) {
          collectedIds.add(link.targetDocId);
          currentLevel.push(link.targetDocId);
        }
      }

      // 限制节点数量
      if (collectedIds.size >= maxNodes) {
        break;
      }
    }

    // 获取文档详情
    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: Array.from(collectedIds).slice(0, maxNodes) },
        isArchived: false,
      },
      include: {
        folder: { select: { name: true } },
        tags: {
          include: { tag: { select: { name: true } } },
        },
      },
    });

    // 获取链接
    const finalDocIds = documents.map((d) => d.id);
    const links = await this.prisma.biLink.findMany({
      where: {
        AND: [
          { sourceDocId: { in: finalDocIds } },
          { targetDocId: { in: finalDocIds } },
        ],
      },
    });

    const graphData = this.buildGraphData(documents, links);

    // 标记中心节点
    const centerNode = graphData.nodes.find((n) => n.id === centerDocId);
    if (centerNode) {
      centerNode.type = 'center';
    }

    return graphData;
  }

  /**
   * 获取文档的连接统计
   */
  async getDocumentStats(documentId: string): Promise<{
    outLinks: number;
    inLinks: number;
    totalConnections: number;
  }> {
    const [outLinks, inLinks] = await Promise.all([
      this.prisma.biLink.count({ where: { sourceDocId: documentId } }),
      this.prisma.biLink.count({ where: { targetDocId: documentId } }),
    ]);

    return {
      outLinks,
      inLinks,
      totalConnections: outLinks + inLinks,
    };
  }

  /**
   * 获取热门连接文档
   */
  async getHotDocuments(limit: number = 10): Promise<
    Array<{
      id: string;
      title: string;
      connections: number;
    }>
  > {
    const documents = await this.prisma.document.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        title: true,
        sourceLinks: { select: { id: true } },
        targetLinks: { select: { id: true } },
      },
    });

    const stats = documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      connections: doc.sourceLinks.length + doc.targetLinks.length,
    }));

    return stats
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);
  }

  /**
   * 构建图谱数据
   */
  private buildGraphData(documents: any[], links: any[]): GraphData {
    // 构建节点
    const nodes: GraphNode[] = documents.map((doc, index) => ({
      id: doc.id,
      type: 'document',
      data: {
        label: doc.title,
        folder: doc.folder?.name,
        tags: doc.tags.map((t: any) => t.tag.name),
        isFavorite: doc.isFavorite,
        isPinned: doc.isPinned,
        wordCount: doc.wordCount,
        updatedAt: doc.updatedAt.toISOString(),
      },
      // 初始位置将由前端布局算法计算
      position: { x: 0, y: 0 },
    }));

    // 构建边
    const edges: GraphEdge[] = links.map((link) => ({
      id: link.id,
      source: link.sourceDocId,
      target: link.targetDocId,
      type: 'default',
      label: link.linkText,
      animated: false,
    }));

    // 计算统计信息
    const connectedNodeIds = new Set([
      ...links.map((l) => l.sourceDocId),
      ...links.map((l) => l.targetDocId),
    ]);
    const isolatedNodes = nodes.filter((n) => !connectedNodeIds.has(n.id)).length;

    // 计算连通分量（简化版）
    const connectedComponents = this.countConnectedComponents(nodes, edges);

    return {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        isolatedNodes,
        connectedComponents,
      },
    };
  }

  /**
   * 计算连通分量数量
   */
  private countConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
    if (nodes.length === 0) return 0;

    // 构建邻接表
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach((n) => adjacency.set(n.id, new Set()));
    edges.forEach((e) => {
      adjacency.get(e.source)?.add(e.target);
      adjacency.get(e.target)?.add(e.source);
    });

    // BFS 计算连通分量
    const visited = new Set<string>();
    let components = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        components++;
        const queue = [node.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);
          for (const neighbor of adjacency.get(current) || []) {
            if (!visited.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }
      }
    }

    return components;
  }
}
