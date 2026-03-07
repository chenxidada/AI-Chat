'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/use-documents';
import { TagSelector } from '@/components/tags/tag-selector';
import { MarkdownPreview } from '@/components/documents/markdown-preview';
import { formatRelativeTime } from '@/lib/utils';

export default function DocumentEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: doc, isLoading } = useDocument(id);
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  // Sync from server
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setTagIds(doc.tags.map((t) => t.id));
      setHasChanges(false);
    }
  }, [doc]);

  // Track changes
  useEffect(() => {
    if (doc) {
      const changed =
        title !== doc.title ||
        content !== doc.content ||
        JSON.stringify(tagIds.sort()) !==
          JSON.stringify(doc.tags.map((t) => t.id).sort());
      setHasChanges(changed);
    }
  }, [title, content, tagIds, doc]);

  // Save
  const handleSave = useCallback(() => {
    if (!hasChanges || !doc) return;
    updateDocument.mutate(
      { id: doc.id, title, content, tagIds },
      { onSuccess: () => setHasChanges(false) }
    );
  }, [hasChanges, doc, title, content, tagIds, updateDocument]);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleDelete = () => {
    if (!doc) return;
    if (confirm(`确定永久删除"${doc.title}"？`)) {
      deleteDocument.mutate(doc.id, {
        onSuccess: () => router.push('/documents'),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-10 bg-gray-100 rounded animate-pulse w-1/2" />
        <div className="h-6 bg-gray-100 rounded animate-pulse w-1/4" />
        <div className="h-96 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        文档不存在
      </div>
    );
  }

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
          <div className="text-sm text-gray-500">
            {doc.folder ? doc.folder.name : '未分类'} / {mode === 'edit' ? '编辑' : '预览'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {doc.wordCount} 字 | 更新于 {formatRelativeTime(doc.updatedAt)}
          </span>

          {/* Edit / Preview toggle */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setMode('edit')}
              className={`px-3 py-1 text-xs transition-colors ${
                mode === 'edit'
                  ? 'bg-gray-200 text-gray-800 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              编辑
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`px-3 py-1 text-xs transition-colors ${
                mode === 'preview'
                  ? 'bg-gray-200 text-gray-800 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              预览
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChanges || updateDocument.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateDocument.isPending ? '保存中...' : hasChanges ? '保存' : '已保存'}
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600"
            title="删除文档"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Editor / Preview area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Title */}
          {mode === 'edit' ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入文档标题..."
              className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent"
              maxLength={500}
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          )}

          {/* Tags */}
          {mode === 'edit' && (
            <div className="max-w-md">
              <TagSelector selectedIds={tagIds} onChange={setTagIds} />
            </div>
          )}

          {/* Content */}
          {mode === 'edit' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="开始写作... (支持 Markdown 语法)"
              className="w-full min-h-[500px] text-base text-gray-800 placeholder-gray-300 border-none outline-none bg-transparent resize-none leading-relaxed font-mono"
            />
          ) : (
            <MarkdownPreview content={content} />
          )}
        </div>
      </div>
    </div>
  );
}
