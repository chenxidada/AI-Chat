'use client';

import { forwardRef, useCallback, useState, useRef } from 'react';
import { CodeMirrorEditor, type EditorHandle } from './codemirror-editor';
import { useUploadImage } from '@/hooks/use-images';

interface EditorWithUploadProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
  placeholder?: string;
  className?: string;
  documentId?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getImageFullUrl(url: string) {
  if (url.startsWith('http')) return url;
  const base = API_URL.replace(/\/api$/, '');
  return `${base}${url}`;
}

export const EditorWithUpload = forwardRef<EditorHandle, EditorWithUploadProps>(
  function EditorWithUpload(
    { value, onChange, onCursorChange, onSave, placeholder, className, documentId },
    ref,
  ) {
    const [dragOver, setDragOver] = useState(false);
    const innerRef = useRef<EditorHandle>(null);
    const uploadImage = useUploadImage();

    // Merge refs
    const setRef = useCallback(
      (handle: EditorHandle | null) => {
        (innerRef as React.MutableRefObject<EditorHandle | null>).current = handle;
        if (typeof ref === 'function') {
          ref(handle);
        } else if (ref) {
          (ref as React.MutableRefObject<EditorHandle | null>).current = handle;
        }
      },
      [ref],
    );

    const handleImageFile = useCallback(
      async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const view = innerRef.current?.getView();
        if (!view) return;

        // Insert placeholder
        const placeholderText = `![uploading ${file.name}...]()`;
        const pos = view.state.selection.main.head;
        view.dispatch({ changes: { from: pos, insert: placeholderText } });

        try {
          const result = await uploadImage.mutateAsync({ file, documentId });
          const fullUrl = getImageFullUrl(result.url);
          const mdImage = `![${result.originalName}](${fullUrl})`;

          // Replace placeholder with actual image
          const doc = view.state.doc.toString();
          const idx = doc.indexOf(placeholderText);
          if (idx >= 0) {
            view.dispatch({
              changes: { from: idx, to: idx + placeholderText.length, insert: mdImage },
            });
          }
        } catch {
          // Remove placeholder on failure
          const doc = view.state.doc.toString();
          const idx = doc.indexOf(placeholderText);
          if (idx >= 0) {
            view.dispatch({
              changes: { from: idx, to: idx + placeholderText.length, insert: '' },
            });
          }
        }
      },
      [uploadImage, documentId],
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        const files = e.dataTransfer?.files;
        if (!files) return;
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            handleImageFile(files[i]);
            return;
          }
        }
      },
      [handleImageFile],
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) handleImageFile(file);
            return;
          }
        }
      },
      [handleImageFile],
    );

    return (
      <div
        className={`relative ${className || ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onPaste={handlePaste}
      >
        <CodeMirrorEditor
          ref={setRef}
          value={value}
          onChange={onChange}
          onCursorChange={onCursorChange}
          onSave={onSave}
          placeholder={placeholder}
          className="h-full"
        />
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-blue-600">释放以上传图片</p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
