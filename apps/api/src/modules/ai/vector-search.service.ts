import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface VectorSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
  documentIds?: string[];
  folderId?: string;
  tagIds?: string[];
}

export interface SearchResult {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  chunkText: string;
  heading: string | null;
  similarity: number;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * 向量相似度搜索
   */
  async search(params: VectorSearchParams): Promise<SearchResult[]> {
    const {
      query,
      limit = 8,
      threshold = 0.7,
      documentIds,
      folderId,
      tagIds,
    } = params;

    const startTime = Date.now();

    // 1. 获取查询向量
    const { embedding: queryEmbedding } = await this.embedding.embedText(query);

    // 2. 构建过滤条件
    const filters = this.buildFilters({ documentIds, folderId, tagIds });

    // 3. 执行向量搜索
    const results = await this.executeSearch(
      queryEmbedding,
      limit,
      threshold,
      filters,
    );

    this.logger.log(
      `Vector search completed in ${Date.now() - startTime}ms, found ${results.length} results`,
    );

    return results;
  }

  /**
   * 构建过滤条件
   */
  private buildFilters(params: {
    documentIds?: string[];
    folderId?: string;
    tagIds?: string[];
  }): string {
    const conditions: string[] = ['d.is_archived = false'];

    if (params.documentIds?.length) {
      const ids = params.documentIds.map((id) => `'${id}'`).join(',');
      conditions.push(`dc.document_id IN (${ids})`);
    }

    if (params.folderId) {
      conditions.push(`d.folder_id = '${params.folderId}'`);
    }

    if (params.tagIds?.length) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM document_tags dt
          WHERE dt.document_id = d.id
          AND dt.tag_id IN (${params.tagIds.map((id) => `'${id}'`).join(',')})
        )
      `);
    }

    return conditions.join(' AND ');
  }

  /**
   * 执行向量搜索 SQL
   */
  private async executeSearch(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
    filters: string,
  ): Promise<SearchResult[]> {
    // 将向量转换为字符串格式
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const sql = `
      SELECT
        dc.id,
        dc.document_id as "documentId",
        dc.chunk_index as "chunkIndex",
        dc.chunk_text as "chunkText",
        dc.heading,
        d.title as "documentTitle",
        1 - (dc.embedding <=> $1::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE ${filters}
        AND 1 - (dc.embedding <=> $1::vector) > $2
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $3
    `;

    const results = await this.prisma.$queryRawUnsafe<SearchResult[]>(
      sql,
      vectorStr,
      threshold,
      limit,
    );

    return results;
  }
}
