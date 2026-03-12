# Phase 2-2b Spec: 引用系统 + 前端界面

## 1. 目标

构建完整的 AI 对话前端界面，包括：
- 对话列表页面
- 对话详情页面（聊天界面）
- 引用标记和悬停预览
- 上下文选择器（文件夹/标签/文档）
- 模式切换（通用/知识库）

## 2. 前置条件

- [x] Phase 2-2a 完成
- [x] RAG API 可用
- [x] 对话 CRUD API 可用

---

## 3. 页面结构

```
app/(main)/
├── conversations/              # 对话列表页
│   ├── page.tsx               # 列表页面
│   ├── new/                   # 新建对话
│   │   └── page.tsx
│   └── [id]/                  # 对话详情页
│       └── page.tsx
└── layout.tsx                 # 主布局（更新侧边栏）
```

---

## 4. 组件结构

```
components/
├── ai/
│   ├── chat-interface.tsx     # 聊天主界面
│   ├── chat-messages.tsx      # 消息列表
│   ├── chat-input.tsx         # 输入框
│   ├── ai-message.tsx         # AI 消息（含引用）
│   ├── user-message.tsx       # 用户消息
│   ├── citation-badge.tsx     # 引用标记 [1][2]
│   ├── citation-popover.tsx   # 引用悬停预览
│   ├── context-selector.tsx   # 上下文选择器
│   └── mode-toggle.tsx        # 模式切换
├── conversations/
│   ├── conversation-list.tsx  # 对话列表
│   └── conversation-card.tsx  # 对话卡片
```

---

## 5. 核心组件实现

### 5.1 ChatInterface

```tsx
// apps/web/components/ai/chat-interface.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ContextSelector } from './context-selector';
import { ModeToggle } from './mode-toggle';
import { useAIChat } from '@/hooks/use-ai-chat';
import { useConversationStore } from '@/stores/conversation-store';

interface ChatInterfaceProps {
  conversationId?: string;
  initialMessages?: any[];
}

export function ChatInterface({ conversationId, initialMessages = [] }: ChatInterfaceProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showContextSelector, setShowContextSelector] = useState(false);

  const {
    currentMode,
    setMode,
    context,
    updateContext,
  } = useConversationStore();

  const {
    messages,
    isLoading,
    sendMessage,
  } = useAIChat({
    conversationId,
    initialMessages,
    mode: currentMode,
    context,
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
    // 跳转到文档页面
    router.push(`/documents/${citation.documentId}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <ModeToggle value={currentMode} onChange={setMode} />
          {currentMode === 'knowledge_base' && (
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {context ? '已设置范围' : '设置范围'}
            </button>
          )}
        </div>
      </div>

      {/* 上下文选择器 */}
      {showContextSelector && currentMode === 'knowledge_base' && (
        <div className="border-b p-4">
          <ContextSelector
            value={context}
            onChange={(ctx) => {
              updateContext(ctx);
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
      <div className="border-t p-4">
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
```

### 5.2 ChatMessages

```tsx
// apps/web/components/ai/chat-messages.tsx

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

export function ChatMessages({ messages, isLoading, onCitationClick }: ChatMessagesProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <p>开始新的对话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {messages.map((message) => (
        message.role === 'user' ? (
          <UserMessage key={message.id} content={message.content} />
        ) : (
          <AIMessage
            key={message.id}
            content={message.content}
            citations={message.citations}
            onCitationClick={onCitationClick}
          />
        )
      ))}
      {isLoading && (
        <AIMessage content="" isLoading />
      )}
    </div>
  );
}
```

### 5.3 AIMessage（含引用）

```tsx
// apps/web/components/ai/ai-message.tsx

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CitationBadge } from './citation-badge';
import { CitationPopover } from './citation-popover';

interface AIMessageProps {
  content: string;
  citations?: any[];
  isLoading?: boolean;
  onCitationClick?: (citation: any) => void;
}

export function AIMessage({ content, citations = [], isLoading, onCitationClick }: AIMessageProps) {
  const [activeCitation, setActiveCitation] = useState<any>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);

  // 渲染带引用标记的内容
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-gray-400">AI 正在思考...</span>
        </div>
      );
    }

    // 分割内容，将 [1][2] 等引用标记转为组件
    const parts = content.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const citationNumber = parseInt(match[1]);
        const citation = citations[citationNumber - 1];

        if (citation) {
          return (
            <CitationBadge
              key={index}
              number={citationNumber}
              onClick={(e) => {
                setActiveCitation(citation);
                setPopoverAnchor(e.currentTarget);
              }}
            />
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none">
          {isLoading ? (
            renderContent()
          ) : (
            <>
              <div className="whitespace-pre-wrap">{renderContent()}</div>

              {/* 引用来源列表 */}
              {citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">引用来源：</div>
                  <div className="flex flex-wrap gap-2">
                    {citations.map((citation, index) => (
                      <CitationBadge
                        key={citation.id}
                        number={index + 1}
                        title={citation.documentTitle}
                        onClick={() => onCitationClick?.(citation)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 引用预览弹窗 */}
      {activeCitation && popoverAnchor && (
        <CitationPopover
          citation={activeCitation}
          anchor={popoverAnchor}
          onClose={() => {
            setActiveCitation(null);
            setPopoverAnchor(null);
          }}
          onOpenDocument={() => {
            onCitationClick?.(activeCitation);
            setActiveCitation(null);
            setPopoverAnchor(null);
          }}
        />
      )}
    </div>
  );
}
```

### 5.4 CitationBadge

```tsx
// apps/web/components/ai/citation-badge.tsx

import { cn } from '@/lib/utils';

interface CitationBadgeProps {
  number: number;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function CitationBadge({ number, title, onClick, className }: CitationBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center',
        'w-5 h-5 text-xs font-medium',
        'bg-blue-100 text-blue-700',
        'rounded-full hover:bg-blue-200',
        'transition-colors cursor-pointer',
        className
      )}
      title={title}
    >
      {number}
    </button>
  );
}
```

### 5.5 CitationPopover

```tsx
// apps/web/components/ai/citation-popover.tsx

import { useEffect, useRef } from 'react';

interface Citation {
  id: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}

interface CitationPopoverProps {
  citation: Citation;
  anchor: HTMLElement;
  onClose: () => void;
  onOpenDocument: () => void;
}

export function CitationPopover({ citation, anchor, onClose, onOpenDocument }: CitationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // 计算位置
  useEffect(() => {
    if (!popoverRef.current || !anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popover = popoverRef.current;

    // 显示在锚点上方
    popover.style.left = `${anchorRect.left}px`;
    popover.style.top = `${anchorRect.top - popover.offsetHeight - 8}px`;
  }, [anchor]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border p-3"
    >
      {/* 文档标题 */}
      <div className="font-medium text-sm mb-2 truncate">
        {citation.documentTitle}
      </div>

      {/* 摘要 */}
      <div className="text-xs text-gray-600 mb-3 line-clamp-3">
        {citation.excerpt}
      </div>

      {/* 相似度 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>相似度: {(citation.similarity * 100).toFixed(1)}%</span>
        <button
          onClick={onOpenDocument}
          className="text-blue-500 hover:text-blue-600"
        >
          查看原文 →
        </button>
      </div>
    </div>
  );
}
```

### 5.6 ContextSelector

```tsx
// apps/web/components/ai/context-selector.tsx

import { useState } from 'react';
import { useFolders } from '@/hooks/use-folders';
import { useTags } from '@/hooks/use-tags';
import { useDocuments } from '@/hooks/use-documents';

interface ConversationContext {
  documentIds?: string[];
  folderId?: string | null;
  tagIds?: string[];
}

interface ContextSelectorProps {
  value: ConversationContext | null;
  onChange: (context: ConversationContext) => void;
}

type ScopeType = 'all' | 'folder' | 'tags' | 'documents';

export function ContextSelector({ value, onChange }: ContextSelectorProps) {
  const [scopeType, setScopeType] = useState<ScopeType>('all');

  const { data: folders } = useFolders();
  const { data: tags } = useTags();
  const { data: documents } = useDocuments({ limit: 100 });

  const handleScopeChange = (type: ScopeType) => {
    setScopeType(type);
    if (type === 'all') {
      onChange({});
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">知识范围</div>

      {/* 范围类型选择 */}
      <div className="flex gap-2">
        {[
          { type: 'all', label: '全部文档' },
          { type: 'folder', label: '文件夹' },
          { type: 'tags', label: '标签' },
          { type: 'documents', label: '选择文档' },
        ].map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handleScopeChange(type as ScopeType)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              scopeType === type
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 具体选择 */}
      {scopeType === 'folder' && folders && (
        <select
          value={value?.folderId || ''}
          onChange={(e) => onChange({ folderId: e.target.value || null })}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">选择文件夹</option>
          {folders.map((f: any) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      )}

      {scopeType === 'tags' && tags && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag: any) => (
            <button
              key={tag.id}
              onClick={() => {
                const currentIds = value?.tagIds || [];
                const newIds = currentIds.includes(tag.id)
                  ? currentIds.filter((id) => id !== tag.id)
                  : [...currentIds, tag.id];
                onChange({ tagIds: newIds });
              }}
              className={`px-2 py-1 text-xs rounded ${
                value?.tagIds?.includes(tag.id)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={{
                backgroundColor: value?.tagIds?.includes(tag.id) ? tag.color : undefined,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {scopeType === 'documents' && documents?.items && (
        <div className="max-h-40 overflow-y-auto border rounded-md">
          {documents.items.map((doc: any) => (
            <label
              key={doc.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value?.documentIds?.includes(doc.id)}
                onChange={(e) => {
                  const currentIds = value?.documentIds || [];
                  const newIds = e.target.checked
                    ? [...currentIds, doc.id]
                    : currentIds.filter((id) => id !== doc.id);
                  onChange({ documentIds: newIds });
                }}
              />
              <span className="text-sm truncate">{doc.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 5.7 ModeToggle

```tsx
// apps/web/components/ai/mode-toggle.tsx

import { cn } from '@/lib/utils';

type ConversationMode = 'general' | 'knowledge_base';

interface ModeToggleProps {
  value: ConversationMode;
  onChange: (mode: ConversationMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('general')}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          value === 'general'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
      >
        🌐 通用对话
      </button>
      <button
        onClick={() => onChange('knowledge_base')}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          value === 'knowledge_base'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
      >
        📚 知识库
      </button>
    </div>
  );
}
```

---

## 6. 页面实现

### 6.1 对话列表页

```tsx
// apps/web/app/(main)/conversations/page.tsx

import Link from 'next/link';
import { ConversationList } from '@/components/conversations/conversation-list';

export default function ConversationsPage() {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold">对话</h1>
        <Link
          href="/conversations/new"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          新对话
        </Link>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        <ConversationList />
      </div>
    </div>
  );
}
```

### 6.2 新建对话页

```tsx
// apps/web/app/(main)/conversations/new/page.tsx

import { ChatInterface } from '@/components/ai/chat-interface';

export default function NewConversationPage() {
  return (
    <div className="h-full">
      <ChatInterface />
    </div>
  );
}
```

### 6.3 对话详情页

```tsx
// apps/web/app/(main)/conversations/[id]/page.tsx

import { notFound } from 'next/navigation';
import { ChatInterface } from '@/components/ai/chat-interface';
import { conversationsApi } from '@/lib/api-client';

interface Props {
  params: { id: string };
}

async function getConversation(id: string) {
  try {
    return await conversationsApi.get(id);
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
    <div className="h-full">
      <ChatInterface
        conversationId={params.id}
        initialMessages={conversation.messages}
      />
    </div>
  );
}
```

### 6.4 ConversationList

```tsx
// apps/web/components/conversations/conversation-list.tsx

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
          <Link href="/conversations/new" className="text-blue-500 hover:underline">
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
```

### 6.5 ConversationCard

```tsx
// apps/web/components/conversations/conversation-card.tsx

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

export function ConversationCard({ conversation, onDelete }: ConversationCardProps) {
  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className="block p-4 bg-white border rounded-lg hover:border-blue-300 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{conversation.title}</div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>{conversation.mode === 'knowledge_base' ? '📚' : '🌐'}</span>
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
            onDelete();
          }}
          className="text-gray-400 hover:text-red-500"
        >
          🗑️
        </button>
      </div>
    </Link>
  );
}
```

---

## 7. Hooks 实现

### 7.1 useAIChat

```tsx
// apps/web/hooks/use-ai-chat.ts

import { useState, useCallback } from 'react';
import { aiApi } from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  createdAt: Date;
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

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);

    // 添加用户消息
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await aiApi.chat({
        question: content,
        conversationId,
        mode: options.mode,
        context: options.context,
      });

      // 更新对话 ID
      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      // 添加 AI 回复
      const assistantMessage: Message = {
        id: response.messageId,
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
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
  }, [conversationId, options.mode, options.context]);

  return {
    messages,
    conversationId,
    isLoading,
    sendMessage,
  };
}
```

---

## 8. 侧边栏更新

```tsx
// apps/web/components/layout/sidebar.tsx 更新

// 在导航项中添加对话入口

const navItems = [
  // ... 原有项
  {
    href: '/conversations',
    icon: '💬',
    label: 'AI 对话',
  },
];
```

---

## 9. 文件产出清单

```
Phase 2-2b 总计：新增 18 文件，修改 3 文件

新增 (18 files):
├── apps/web/app/(main)/conversations/
│   ├── page.tsx                        # 对话列表页
│   ├── new/page.tsx                    # 新建对话页
│   └── [id]/page.tsx                   # 对话详情页
├── apps/web/components/ai/
│   ├── chat-interface.tsx              # 聊天主界面
│   ├── chat-messages.tsx               # 消息列表
│   ├── chat-input.tsx                  # 输入框
│   ├── ai-message.tsx                  # AI 消息
│   ├── user-message.tsx                # 用户消息
│   ├── citation-badge.tsx              # 引用标记
│   ├── citation-popover.tsx            # 引用预览
│   ├── context-selector.tsx            # 上下文选择器
│   └── mode-toggle.tsx                 # 模式切换
├── apps/web/components/conversations/
│   ├── conversation-list.tsx           # 对话列表
│   └── conversation-card.tsx           # 对话卡片
├── apps/web/hooks/
│   └── use-ai-chat.ts                  # AI 聊天 Hook
└── packages/shared/src/types/
    └── conversation.ts                 # 对话类型

修改 (3 files):
├── apps/web/app/(main)/layout.tsx
├── apps/web/components/layout/sidebar.tsx
└── packages/shared/src/types/index.ts
```

---

## 10. 测试验证方案

### 10.1 组件测试

```tsx
// apps/web/components/ai/__tests__/citation-badge.test.tsx

import { render, screen } from '@testing-library/react';
import { CitationBadge } from '../citation-badge';

describe('CitationBadge', () => {
  it('renders number correctly', () => {
    render(<CitationBadge number={1} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<CitationBadge number={1} onClick={onClick} />);

    screen.getByText('1').click();
    expect(onClick).toHaveBeenCalled();
  });
});
```

### 10.2 手动验证清单

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| **对话列表** | 访问 `/conversations` | 显示对话列表 |
| **新建对话** | 点击"新对话" | 进入聊天界面 |
| **发送消息** | 输入内容并发送 | 显示 AI 回复 |
| **引用标记** | 知识库模式提问 | 回复包含 [1][2] |
| **引用预览** | 悬停引用标记 | 显示文档摘要 |
| **跳转原文** | 点击引用 | 跳转到文档页 |
| **模式切换** | 点击切换按钮 | 切换通用/知识库 |
| **上下文选择** | 设置知识范围 | 对话使用指定范围 |
| **对话历史** | 返回列表再进入 | 消息保留 |

### 10.3 E2E 测试

```typescript
// e2e/conversations.spec.ts

import { test, expect } from '@playwright/test';

test.describe('AI Conversations', () => {
  test('should create and display conversation', async ({ page }) => {
    await page.goto('/conversations/new');

    // 等待页面加载
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

    // 发送消息
    await page.fill('[data-testid="chat-input"] textarea', '你好');
    await page.click('[data-testid="send-button"]');

    // 等待 AI 回复
    await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 30000 });
  });

  test('should show citations in knowledge base mode', async ({ page }) => {
    await page.goto('/conversations/new');

    // 切换到知识库模式
    await page.click('text=知识库');

    // 发送问题
    await page.fill('[data-testid="chat-input"] textarea', '知识管理有哪些类型？');
    await page.click('[data-testid="send-button"]');

    // 等待回复并检查引用
    await expect(page.locator('[data-testid="citation-badge"]')).toBeVisible({ timeout: 30000 });
  });
});
```

---

## 11. 完成标准

- [ ] 对话列表页面正常显示
- [ ] 新建对话页面可用
- [ ] 对话详情页面显示历史消息
- [ ] 发送消息功能正常
- [ ] AI 回复正确显示
- [ ] 引用标记可点击
- [ ] 引用悬停预览正常
- [ ] 点击引用可跳转文档
- [ ] 模式切换功能正常
- [ ] 上下文选择器可用
- [ ] 侧边栏包含对话入口

---

## 12. 注意事项

1. **消息渲染**：使用 ReactMarkdown 渲染 AI 回复，注意 XSS 防护
2. **滚动行为**：新消息自动滚动到底部
3. **加载状态**：显示清晰的加载指示器
4. **错误处理**：网络错误时显示友好提示
5. **响应式设计**：移动端适配
