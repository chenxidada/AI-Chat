'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ConversationCardProps {
  conversation: {
    id: string;
    title: string;
    mode: string;
    messageCount: number;
    updatedAt: string;
  };
  onDelete: () => void;
}

export function ConversationCard({
  conversation,
  onDelete,
}: ConversationCardProps) {
  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className="block p-4 bg-white border rounded-lg hover:border-blue-300 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{conversation.title}</div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>
              {conversation.mode === 'knowledge_base' ? '📚' : '🌐'}
            </span>
            <span>{conversation.messageCount} 条消息</span>
            <span>·</span>
            <span>
              {formatDistanceToNow(new Date(conversation.updatedAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm('确定要删除这个对话吗？')) {
              onDelete();
            }
          }}
          className="text-gray-400 hover:text-red-500 ml-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </Link>
  );
}
