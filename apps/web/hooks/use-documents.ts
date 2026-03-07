'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Tag } from './use-tags';

export interface Document {
  id: string;
  title: string;
  content: string;
  contentPlain: string;
  folderId: string | null;
  sourceType: string;
  sourceUrl: string | null;
  wordCount: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  folder: { id: string; name: string } | null;
  tags: Tag[];
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DocumentQuery {
  page?: number;
  limit?: number;
  folderId?: string | null;
  tagId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  keyword?: string;
  isArchived?: string;
}

// 获取文档列表
export function useDocuments(query: DocumentQuery) {
  const params: Record<string, string> = {};
  if (query.page) params.page = String(query.page);
  if (query.limit) params.limit = String(query.limit);
  if (query.folderId) params.folderId = query.folderId;
  if (query.tagId) params.tagId = query.tagId;
  if (query.sortBy) params.sortBy = query.sortBy;
  if (query.sortOrder) params.sortOrder = query.sortOrder;
  if (query.keyword) params.keyword = query.keyword;
  if (query.isArchived) params.isArchived = query.isArchived;

  return useQuery<DocumentListResponse>({
    queryKey: ['documents', params],
    queryFn: async () => {
      const res = await apiClient.get('/v1/documents', { params });
      return res.data;
    },
  });
}

// 获取单个文档
export function useDocument(id: string | null) {
  return useQuery<Document>({
    queryKey: ['documents', id],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/documents/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

// 获取最近文档
export function useRecentDocuments(limit = 10) {
  return useQuery<Document[]>({
    queryKey: ['documents', 'recent', limit],
    queryFn: async () => {
      const res = await apiClient.get('/v1/documents/recent', { params: { limit } });
      return res.data;
    },
  });
}

// 创建文档
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      content?: string;
      folderId?: string;
      tagIds?: string[];
    }) => {
      const res = await apiClient.post('/v1/documents', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// 更新文档
export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      content?: string;
      folderId?: string | null;
      tagIds?: string[];
    }) => {
      const res = await apiClient.patch(`/v1/documents/${id}`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// 删除文档
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/v1/documents/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// 归档/取消归档
export function useArchiveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch(`/v1/documents/${id}/archive`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// 移动文档到文件夹
export function useMoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
      const res = await apiClient.patch(`/v1/documents/${id}/move`, { folderId });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
