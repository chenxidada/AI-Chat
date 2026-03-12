import Link from 'next/link';
import { ConversationList } from '@/components/conversations/conversation-list';

export default function ConversationsPage() {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <h1 className="text-xl font-semibold">对话</h1>
        <Link
          href="/conversations/new"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          新对话
        </Link>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <ConversationList />
      </div>
    </div>
  );
}
