'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateDocument } from '@/hooks/use-documents';
import { useAppStore } from '@/stores/app-store';
import { TagSelector } from '@/components/tags/tag-selector';

export default function NewDocumentPage() {
  const router = useRouter();
  const createDocument = useCreateDocument();
  const { activeFolderId } = useAppStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);

  const handleCreate = () => {
    if (!title.trim()) return;

    createDocument.mutate(
      {
        title: title.trim(),
        content,
        folderId: activeFolderId ?? undefined,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
      },
      {
        onSuccess: (data) => {
          router.push(`/documents/${data.id}`);
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/documents')}
            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-gray-500">新建文档</span>
        </div>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || createDocument.isPending}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createDocument.isPending ? '创建中...' : '创建文档'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文档标题..."
            className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent"
            autoFocus
            maxLength={500}
          />

          <div className="max-w-md">
            <TagSelector selectedIds={tagIds} onChange={setTagIds} />
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="开始写作... (支持 Markdown 语法)"
            className="w-full min-h-[500px] text-base text-gray-800 placeholder-gray-300 border-none outline-none bg-transparent resize-none leading-relaxed font-mono"
          />
        </div>
      </div>
    </div>
  );
}
