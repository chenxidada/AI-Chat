'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  _count: { documents: number };
}

// 获取所有标签
export function useTags() {
  return useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/tags');
      return res.data;
    },
  });
}

// 创建标签
export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const res = await apiClient.post('/v1/tags', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

// 更新标签
export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string }) => {
      const res = await apiClient.patch(`/v1/tags/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

// 删除标签
export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/v1/tags/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
