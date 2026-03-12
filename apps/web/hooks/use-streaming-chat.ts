import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

interface StreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  isStreaming?: boolean;
}

interface UseStreamingChatOptions {
  conversationId?: string;
  mode?: 'general' | 'knowledge_base';
  context?: {
    documentIds?: string[];
    folderId?: string;
    tagIds?: string[];
  };
  onMessageComplete?: (message: StreamMessage) => void;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [conversationId, setConversationId] = useState(options.conversationId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [citations, setCitations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      setIsStreaming(true);
      setStreamingContent('');
      setError(null);

      // 添加用户消息
      const userMessage: StreamMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/ai/chat/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: content,
              conversationId,
              mode: options.mode,
              context: options.context,
            }),
            signal: abortControllerRef.current.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));

                switch (event.type) {
                  case 'conversation':
                    setConversationId(event.data.conversationId);
                    break;

                  case 'citations':
                    setCitations(event.data.citations);
                    break;

                  case 'chunk':
                    setStreamingContent((prev) => prev + event.data.content);
                    break;

                  case 'done':
                    // 添加完整的 AI 消息
                    const assistantMessage: StreamMessage = {
                      id: `assistant-${Date.now()}`,
                      role: 'assistant',
                      content: event.data.content,
                      citations,
                      isStreaming: false,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    options.onMessageComplete?.(assistantMessage);
                    break;

                  case 'error':
                    setError(event.data.message);
                    break;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Stream cancelled');
        } else {
          setError(err.message || '发送消息失败');
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        abortControllerRef.current = null;
      }
    },
    [conversationId, options.mode, options.context, citations],
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setStreamingContent('');
    setCitations([]);
    setError(null);
  }, []);

  return {
    messages,
    conversationId,
    isStreaming,
    streamingContent,
    citations,
    error,
    sendMessage,
    cancelStream,
    clearMessages,
  };
}
