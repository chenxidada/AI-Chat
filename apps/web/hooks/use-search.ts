'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useDebouncedValue } from './use-debounced-value';

export interface SearchHit {
  id: string;
  title: string;
  contentPlain: string;
  folderId: string | null;
  folderName: string | null;
  tags: string[];
  tagIds: string[];
  updatedAt: number;
  wordCount: number;
  _formatted: {
    title: string;
    contentPlain: string;
  };
}

export interface SearchResponse {
  hits: SearchHit[];
  query: string;
  estimatedTotalHits: number;
  processingTimeMs: number;
  page: number;
  limit: number;
}

interface SearchOptions {
  folderId?: string;
  tagIds?: string;
  page?: number;
  limit?: number;
}

export function useSearch(query: string, options?: SearchOptions) {
  const debouncedQuery = useDebouncedValue(query, 300);

  return useQuery<SearchResponse>({
    queryKey: ['search', debouncedQuery, options],
    queryFn: async () => {
      const params: Record<string, string> = { q: debouncedQuery };
      if (options?.folderId) params.folderId = options.folderId;
      if (options?.tagIds) params.tagIds = options.tagIds;
      if (options?.page) params.page = String(options.page);
      if (options?.limit) params.limit = String(options.limit);

      const res = await apiClient.get('/v1/search', { params });
      return res.data;
    },
    enabled: debouncedQuery.length > 0,
  });
}
