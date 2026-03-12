'use client';

import Link from 'next/link';
import { useConversations, useDeleteConversation } from '@/hooks/use-conversations';
import { ConversationCard } from './conversation-card';

export function ConversationList() {
  const { data, isLoading } = useConversations({ limit: 50 });
  const deleteMutation = useDeleteConversation();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.items?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <p>暂无对话</p>
          <Link
            href="/conversations/new"
            className="text-blue-500 hover:underline"
          >
            开始新对话
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {data.items.map((conversation: any) => (
        <ConversationCard
          key={conversation.id}
          conversation={conversation}
          onDelete={() => deleteMutation.mutate(conversation.id)}
        />
      ))}
    </div>
  );
}
