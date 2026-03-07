import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index, EnqueuedTask } from 'meilisearch';

export interface MeiliDocument {
  id: string;
  title: string;
  contentPlain: string;
  folderId: string | null;
  folderName: string | null;
  tagIds: string[];
  tags: string[];
  sourceType: string;
  isArchived: boolean;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  folderId?: string;
  tagIds?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class MeiliService implements OnModuleInit {
  private readonly logger = new Logger(MeiliService.name);
  private client: MeiliSearch;
  private index: Index;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('meilisearch.host', 'http://localhost:7700');
    const apiKey = this.config.get<string>('meilisearch.apiKey');

    this.client = new MeiliSearch({
      host,
      apiKey: apiKey || undefined,
    });

    this.index = this.client.index('documents');

    try {
      const task = await this.index.updateSettings({
        searchableAttributes: ['title', 'contentPlain', 'tags'],
        filterableAttributes: ['folderId', 'tagIds', 'isArchived', 'sourceType'],
        sortableAttributes: ['createdAt', 'updatedAt', 'wordCount'],
      });
      await this.client.waitForTask(task.taskUid, { timeOutMs: 10000 });
      this.logger.log('Meilisearch index configured successfully');
    } catch (err) {
      this.logger.warn(`Meilisearch init failed: ${err.message}. Search features will be unavailable.`);
    }
  }

  private async waitForEnqueued(task: EnqueuedTask): Promise<void> {
    await this.client.waitForTask(task.taskUid, { timeOutMs: 30000 });
  }

  async indexDocument(doc: MeiliDocument): Promise<void> {
    const task = await this.index.addDocuments([doc], { primaryKey: 'id' });
    await this.waitForEnqueued(task);
  }

  async indexDocuments(docs: MeiliDocument[]): Promise<void> {
    const task = await this.index.addDocuments(docs, { primaryKey: 'id' });
    await this.waitForEnqueued(task);
  }

  async removeDocument(id: string): Promise<void> {
    const task = await this.index.deleteDocument(id);
    await this.waitForEnqueued(task);
  }

  async search(query: string, options: SearchOptions) {
    const limit = options.limit || 20;
    const page = options.page || 1;

    return this.index.search(query, {
      limit,
      offset: (page - 1) * limit,
      filter: this.buildFilter(options),
      sort: options.sort
        ? [`${options.sort}:${options.order || 'desc'}`]
        : undefined,
      attributesToHighlight: ['title', 'contentPlain'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      attributesToCrop: ['contentPlain'],
      cropLength: 200,
    });
  }

  async reindexAll(documents: MeiliDocument[]): Promise<void> {
    const delTask = await this.index.deleteAllDocuments();
    await this.waitForEnqueued(delTask);

    if (documents.length > 0) {
      for (let i = 0; i < documents.length; i += 500) {
        const batch = documents.slice(i, i + 500);
        const addTask = await this.index.addDocuments(batch, { primaryKey: 'id' });
        await this.waitForEnqueued(addTask);
      }
    }
  }

  private buildFilter(options: SearchOptions): string[] {
    const filters: string[] = [];
    if (options.folderId) {
      filters.push(`folderId = "${options.folderId}"`);
    }
    if (options.tagIds) {
      options.tagIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => filters.push(`tagIds = "${id}"`));
    }
    filters.push('isArchived = false');
    return filters;
  }
}
