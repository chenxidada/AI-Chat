'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: { documents: number };
  children: Folder[];
}

// 获取文件夹树
export function useFolderTree() {
  return useQuery<Folder[]>({
    queryKey: ['folders', 'tree'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/folders');
      return res.data;
    },
  });
}

// 获取文件夹列表（扁平化）
export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ['folders', 'tree'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/folders');
      return res.data;
    },
  });
}

// 创建文件夹
export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; parentId?: string }) => {
      const res = await apiClient.post('/v1/folders', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}

// 更新文件夹
export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; parentId?: string | null }) => {
      const res = await apiClient.patch(`/v1/folders/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}

// 删除文件夹
export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/v1/folders/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
