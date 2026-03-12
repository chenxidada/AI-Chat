'use client';

import { UserMessage } from './user-message';
import { AIMessage } from './ai-message';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  createdAt: Date;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  onCitationClick: (citation: any) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  onCitationClick,
}: ChatMessagesProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <p>开始新的对话</p>
          <p className="text-sm mt-2">输入问题，AI 将为您解答</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} content={message.content} />
        ) : (
          <AIMessage
            key={message.id}
            content={message.content}
            citations={message.citations}
            onCitationClick={onCitationClick}
          />
        ),
      )}
      {isLoading && <AIMessage content="" isLoading />}
    </div>
  );
}
