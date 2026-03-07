import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MeiliService, MeiliDocument } from './meili.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meili: MeiliService,
  ) {}

  async search(query: SearchQueryDto) {
    const result = await this.meili.search(query.q, {
      page: query.page,
      limit: query.limit,
      folderId: query.folderId,
      tagIds: query.tagIds,
    });

    return {
      hits: result.hits,
      query: result.query,
      estimatedTotalHits: result.estimatedTotalHits,
      processingTimeMs: result.processingTimeMs,
      page: query.page || 1,
      limit: query.limit || 20,
    };
  }

  async reindexAll(): Promise<{ indexed: number }> {
    const documents = await this.prisma.document.findMany({
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });

    const meiliDocs: MeiliDocument[] = documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      contentPlain: doc.contentPlain,
      folderId: doc.folderId,
      folderName: doc.folder?.name || null,
      tagIds: doc.tags.map((t) => t.tagId),
      tags: doc.tags.map((t) => t.tag.name),
      sourceType: doc.sourceType,
      isArchived: doc.isArchived,
      wordCount: doc.wordCount,
      createdAt: Math.floor(doc.createdAt.getTime() / 1000),
      updatedAt: Math.floor(doc.updatedAt.getTime() / 1000),
    }));

    await this.meili.reindexAll(meiliDocs);
    this.logger.log(`Reindexed ${meiliDocs.length} documents to Meilisearch`);

    return { indexed: meiliDocs.length };
  }
}
