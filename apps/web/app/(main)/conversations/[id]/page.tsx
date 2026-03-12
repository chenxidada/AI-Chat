import { notFound } from 'next/navigation';
import { ChatInterface } from '@/components/ai/chat-interface';
import apiClient from '@/lib/api-client';

interface Props {
  params: { id: string };
}

async function getConversation(id: string) {
  try {
    const response = await apiClient.get(`/conversations/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

export default async function ConversationDetailPage({ params }: Props) {
  const conversation = await getConversation(params.id);

  if (!conversation) {
    notFound();
  }

  return (
    <div className="h-full flex flex-col">
      <ChatInterface
        conversationId={params.id}
        initialMessages={conversation.messages || []}
      />
    </div>
  );
}
