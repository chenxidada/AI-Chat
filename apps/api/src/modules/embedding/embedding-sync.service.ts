import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChunkingService } from '../ai/chunking.service';
import { EmbeddingService } from '../ai/embedding.service';

export interface SyncStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalChunks: number;
  processedChunks: number;
  error?: string;
}

@Injectable()
export class EmbeddingSyncService {
  private readonly logger = new Logger(EmbeddingSyncService.name);

  // 正在处理的文档
  private readonly processingDocs = new Map<string, SyncStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * 同步单个文档
   */
  async syncDocument(documentId: string): Promise<SyncStatus> {
    // 检查是否正在处理
    if (this.processingDocs.has(documentId)) {
      return this.processingDocs.get(documentId)!;
    }

    const status: SyncStatus = {
      documentId,
      status: 'processing',
      totalChunks: 0,
      processedChunks: 0,
    };
    this.processingDocs.set(documentId, status);

    try {
      // 1. 获取文档
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (document.isArchived) {
        throw new Error(`Document ${documentId} is archived`);
      }

      // 2. 分块
      const chunks = this.chunking.chunkDocument(document.content);
      status.totalChunks = chunks.length;

      this.logger.log(
        `Document ${documentId} chunked into ${chunks.length} chunks`,
      );

      // 3. 删除旧的分块
      await this.prisma.documentChunk.deleteMany({
        where: { documentId },
      });

      // 4. 批量向量化并保存
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // 获取向量
        const { embedding } = await this.embedding.embedText(chunk.chunkText);

        // 使用原生 SQL 插入向量数据
        await this.prisma.$executeRaw`
          INSERT INTO document_chunks (
            document_id, chunk_index, chunk_text, heading,
            token_count, embedding, content_hash
          ) VALUES (
            ${documentId}::uuid,
            ${chunk.chunkIndex},
            ${chunk.chunkText},
            ${chunk.heading},
            ${chunk.tokenCount},
            ${`[${embedding.join(',')}]`}::vector,
            ${chunk.contentHash}
          )
        `;

        status.processedChunks = i + 1;
        this.processingDocs.set(documentId, { ...status });
      }

      status.status = 'completed';
      this.processingDocs.delete(documentId);

      this.logger.log(`Document ${documentId} sync completed`);

      return status;
    } catch (error) {
      status.status = 'failed';
      status.error = error.message;
      this.processingDocs.delete(documentId);

      this.logger.error(
        `Document ${documentId} sync failed: ${error.message}`,
      );

      return status;
    }
  }

  /**
   * 同步所有文档
   */
  async syncAll(): Promise<{ total: number; completed: number; failed: number }> {
    const documents = await this.prisma.document.findMany({
      where: { isArchived: false },
      select: { id: true },
    });

    let completed = 0;
    let failed = 0;

    for (const doc of documents) {
      try {
        const status = await this.syncDocument(doc.id);
        if (status.status === 'completed') {
          completed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to sync document ${doc.id}: ${error.message}`,
        );
      }
    }

    return { total: documents.length, completed, failed };
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(documentId: string): SyncStatus | null {
    return this.processingDocs.get(documentId) || null;
  }

  /**
   * 删除文档的向量数据
   */
  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    this.logger.log(`Deleted chunks for document ${documentId}`);
  }
}
