'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useUpdateDocument, useDeleteDocument } from '@/hooks/use-documents';
import { TagSelector } from '@/components/tags/tag-selector';
import { MarkdownPreview } from '@/components/documents/markdown-preview';
import { type EditorHandle } from '@/components/editor/codemirror-editor';
import { EditorWithUpload } from '@/components/editor/editor-with-upload';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorStatusBar } from '@/components/editor/editor-status-bar';
import { ShortcutPanel } from '@/components/editor/shortcut-panel';
import { MathInsertDialog } from '@/components/editor/math-insert-dialog';
import { ImageInsertDialog } from '@/components/editor/image-insert-dialog';
import { useAutoSave } from '@/hooks/use-auto-save';
import { formatRelativeTime } from '@/lib/utils';

type ViewMode = 'edit' | 'preview' | 'split';

function countWords(text: string): number {
  if (!text) return 0;
  // Count Chinese characters + English words
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (text.match(/[a-zA-Z]+/g) || []).length;
  return chinese + english;
}

export default function DocumentEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const editorRef = useRef<EditorHandle>(null);

  const { data: doc, isLoading } = useDocument(id);
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [shortcutPanelOpen, setShortcutPanelOpen] = useState(false);
  const [mathDialogOpen, setMathDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync from server (only on first load)
  useEffect(() => {
    if (doc && !initialized) {
      setTitle(doc.title);
      setContent(doc.content);
      setTagIds(doc.tags.map((t: { id: string }) => t.id));
      setInitialized(true);
    }
  }, [doc, initialized]);

  // Auto-save
  const { saveStatus, scheduleAutoSave, manualSave } = useAutoSave({
    onSave: async () => {
      await updateDocument.mutateAsync({ id, title, content, tagIds });
    },
  });

  // Content change from editor
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  // Title change
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  // Tag change
  const handleTagChange = useCallback(
    (newTagIds: string[]) => {
      setTagIds(newTagIds);
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  // Cursor change from editor
  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

  // Ctrl+/ for shortcut panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutPanelOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDelete = () => {
    if (!doc) return;
    if (confirm(`确定永久删除"${doc.title}"？`)) {
      deleteDocument.mutate(doc.id, {
        onSuccess: () => router.push('/documents'),
      });
    }
  };

  const wordCount = useMemo(() => countWords(content), [content]);

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
            onChange={handleTitleChange}
            placeholder="输入文档标题..."
            className="text-lg font-semibold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent min-w-0 flex-1"
            maxLength={500}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="max-w-[200px]">
            <TagSelector selectedIds={tagIds} onChange={handleTagChange} />
          </div>
          <span className="text-xs text-gray-400 hidden sm:inline">
            更新于 {formatRelativeTime(doc.updatedAt)}
          </span>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600"
            title="删除文档"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Toolbar (visible in edit/split mode) */}
      {viewMode !== 'preview' && (
        <EditorToolbar
          editorRef={editorRef}
          onMathInsert={() => setMathDialogOpen(true)}
          onImageInsert={() => setImageDialogOpen(true)}
        />
      )}

      {/* Editor + Preview area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Editor pane */}
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
              onSave={manualSave}
              className="h-full"
              documentId={id}
            />
          </div>
        )}

        {/* Preview pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            } overflow-auto`}
          >
            <div className="p-6 max-w-3xl mx-auto">
              {viewMode === 'preview' && (
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

      {/* Shortcut reference panel */}
      <ShortcutPanel
        open={shortcutPanelOpen}
        onClose={() => setShortcutPanelOpen(false)}
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
        documentId={id}
      />
    </div>
  );
}
