'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateDocument } from '@/hooks/use-documents';
import { useAppStore } from '@/stores/app-store';
import { TagSelector } from '@/components/tags/tag-selector';
import { MarkdownPreview } from '@/components/documents/markdown-preview';
import { type EditorHandle } from '@/components/editor/codemirror-editor';
import { EditorWithUpload } from '@/components/editor/editor-with-upload';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorStatusBar } from '@/components/editor/editor-status-bar';
import { MathInsertDialog } from '@/components/editor/math-insert-dialog';
import { ImageInsertDialog } from '@/components/editor/image-insert-dialog';
import type { AutoSaveStatus } from '@/hooks/use-auto-save';

type ViewMode = 'edit' | 'preview' | 'split';

function countWords(text: string): number {
  if (!text) return 0;
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (text.match(/[a-zA-Z]+/g) || []).length;
  return chinese + english;
}

export default function NewDocumentPage() {
  const router = useRouter();
  const createDocument = useCreateDocument();
  const { activeFolderId } = useAppStore();
  const editorRef = useRef<EditorHandle>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [mathDialogOpen, setMathDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // New document doesn't auto-save; use a static status
  const saveStatus: AutoSaveStatus = {
    status: 'idle',
    lastSavedAt: null,
    error: null,
  };

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

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

  const wordCount = useMemo(() => countWords(content), [content]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/documents')}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文档标题..."
            className="text-lg font-semibold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent min-w-0 flex-1"
            autoFocus
            maxLength={500}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="max-w-[200px]">
            <TagSelector selectedIds={tagIds} onChange={setTagIds} />
          </div>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || createDocument.isPending}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createDocument.isPending ? '创建中...' : '创建文档'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {viewMode !== 'preview' && (
        <EditorToolbar
          editorRef={editorRef}
          onMathInsert={() => setMathDialogOpen(true)}
          onImageInsert={() => setImageDialogOpen(true)}
        />
      )}

      {/* Editor + Preview */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'w-full'
            } overflow-hidden`}
          >
            <EditorWithUpload
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              onCursorChange={handleCursorChange}
              className="h-full"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            } overflow-auto`}
          >
            <div className="p-6 max-w-3xl mx-auto">
              {viewMode === 'preview' && title && (
                <h1 className="text-3xl font-bold text-gray-900 mb-6">{title}</h1>
              )}
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <EditorStatusBar
        wordCount={wordCount}
        saveStatus={saveStatus}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Math insert dialog */}
      <MathInsertDialog
        open={mathDialogOpen}
        onClose={() => setMathDialogOpen(false)}
        editorRef={editorRef}
      />

      {/* Image insert dialog */}
      <ImageInsertDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        editorRef={editorRef}
      />
    </div>
  );
}
