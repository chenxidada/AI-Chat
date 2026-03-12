'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAIChat } from '@/hooks/use-ai-chat';
import { useConversationStore } from '@/stores/conversation-store';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ContextSelector } from './context-selector';
import { ModeToggle } from './mode-toggle';

interface ChatInterfaceProps {
  conversationId?: string;
  initialMessages?: any[];
}

export function ChatInterface({
  conversationId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showContextSelector, setShowContextSelector] = useState(false);

  const { currentMode, setMode, context, setContext } =
    useConversationStore();

  const { messages, isLoading, sendMessage } = useAIChat({
    conversationId,
    initialMessages,
    mode: currentMode,
    context: {
      documentIds: context.documentIds,
      folderId: context.folderId || undefined,
      tagIds: context.tagIds,
    },
  });

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;
    await sendMessage(content);
  };

  const handleCitationClick = (citation: any) => {
    router.push(`/documents/${citation.documentId}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <ModeToggle value={currentMode} onChange={setMode} />
          {currentMode === 'knowledge_base' && (
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {context.documentIds.length > 0 ||
              context.folderId ||
              context.tagIds.length > 0
                ? '已设置范围'
                : '设置范围'}
            </button>
          )}
        </div>
      </div>

      {/* 上下文选择器 */}
      {showContextSelector && currentMode === 'knowledge_base' && (
        <div className="border-b p-4 bg-gray-50">
          <ContextSelector
            value={context}
            onChange={(ctx) => {
              setContext(ctx);
              setShowContextSelector(false);
            }}
          />
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onCitationClick={handleCitationClick}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t p-4 bg-white">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder={
            currentMode === 'knowledge_base'
              ? '基于知识库提问...'
              : '输入消息...'
          }
        />
      </div>
    </div>
  );
}
