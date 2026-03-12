import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface Conversation {
  id: string;
  title: string;
  mode: string;
  isArchived: boolean;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

interface ConversationListResponse {
  items: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useConversations(params?: {
  page?: number;
  limit?: number;
  isArchived?: boolean;
}) {
  return useQuery<ConversationListResponse>({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const response = await apiClient.get('/conversations', { params });
      return response.data;
    },
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const response = await apiClient.get(`/conversations/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title?: string; mode?: string }) => {
      const response = await apiClient.post('/conversations', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        title?: string;
        isArchived?: boolean;
        contextDocumentIds?: string[];
        contextFolderId?: string | null;
        contextTagIds?: string[];
      };
    }) => {
      const response = await apiClient.patch(`/conversations/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/conversations/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
