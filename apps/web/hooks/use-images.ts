'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DocumentImage {
  id: string;
  documentId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

// 查询文档关联的图片
export function useDocumentImages(documentId: string | null) {
  return useQuery<DocumentImage[]>({
    queryKey: ['images', documentId],
    queryFn: async () => {
      const res = await apiClient.get('/v1/images', {
        params: { documentId },
      });
      return res.data;
    },
    enabled: !!documentId,
  });
}

// 上传图片
export function useUploadImage() {
  const qc = useQueryClient();
  return useMutation<
    DocumentImage,
    Error,
    { file: File; documentId?: string }
  >({
    mutationFn: async ({ file, documentId }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (documentId) {
        formData.append('documentId', documentId);
      }
      const res = await apiClient.post('/v1/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['images'] });
    },
  });
}

// 删除图片
export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/images/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['images'] });
    },
  });
}
