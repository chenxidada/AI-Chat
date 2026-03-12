import { useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  createdAt: Date;
}

interface ChatResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  citations: any[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface UseAIChatOptions {
  conversationId?: string;
  initialMessages?: Message[];
  mode?: 'general' | 'knowledge_base';
  context?: {
    documentIds?: string[];
    folderId?: string;
    tagIds?: string[];
  };
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages || []);
  const [conversationId, setConversationId] = useState(options.conversationId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);

      // 添加用户消息
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await apiClient.post<ChatResponse>('/ai/chat', {
          question: content,
          conversationId,
          mode: options.mode,
          context: options.context,
        });

        const data = response.data;

        // 更新对话 ID
        if (!conversationId) {
          setConversationId(data.conversationId);
        }

        // 添加 AI 回复
        const assistantMessage: Message = {
          id: data.messageId,
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        return data;
      } catch (err: any) {
        setError(err.message || '发送消息失败');
        // 添加错误消息
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: '抱歉，发生了错误，请稍后重试。',
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, options.mode, options.context],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
