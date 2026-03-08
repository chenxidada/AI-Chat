'use client';

import { useState, useRef, useCallback } from 'react';
import type { EditorHandle } from './codemirror-editor';
import { insertTemplate } from './editor-commands';
import { useUploadImage, useDocumentImages, useDeleteImage } from '@/hooks/use-images';
import type { DocumentImage } from '@/hooks/use-images';

type TabType = 'upload' | 'url' | 'gallery';

interface ImageInsertDialogProps {
  open: boolean;
  onClose: () => void;
  editorRef: React.RefObject<EditorHandle | null>;
  documentId?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getImageFullUrl(url: string) {
  if (url.startsWith('http')) return url;
  // /uploads/images/xxx.png -> http://localhost:4000/uploads/images/xxx.png
  const base = API_URL.replace(/\/api$/, '');
  return `${base}${url}`;
}

export function ImageInsertDialog({ open, onClose, editorRef, documentId }: ImageInsertDialogProps) {
  const [tab, setTab] = useState<TabType>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [altText, setAltText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useUploadImage();
  const { data: images } = useDocumentImages(documentId ?? null);
  const deleteImage = useDeleteImage();

  const insertMarkdownImage = useCallback(
    (url: string, alt: string) => {
      const view = editorRef.current?.getView();
      if (view) {
        insertTemplate(view, `![${alt || '图片'}](${url})`);
      }
      onClose();
      setUrlInput('');
      setAltText('');
    },
    [editorRef, onClose],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      setUploading(true);
      try {
        const result = await uploadImage.mutateAsync({
          file,
          documentId,
        });
        const fullUrl = getImageFullUrl(result.url);
        insertMarkdownImage(fullUrl, result.originalName);
      } catch {
        // error handled by react-query
      } finally {
        setUploading(false);
      }
    },
    [uploadImage, documentId, insertMarkdownImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      e.target.value = '';
    },
    [handleFileUpload],
  );

  const handleUrlInsert = useCallback(() => {
    if (!urlInput.trim()) return;
    insertMarkdownImage(urlInput.trim(), altText);
  }, [urlInput, altText, insertMarkdownImage]);

  const handleGallerySelect = useCallback(
    (img: DocumentImage) => {
      const fullUrl = getImageFullUrl(img.url);
      insertMarkdownImage(fullUrl, img.originalName);
    },
    [insertMarkdownImage],
  );

  const handleDeleteImage = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm('确定删除此图片？')) {
        deleteImage.mutate(id);
      }
    },
    [deleteImage],
  );

  if (!open) return null;

  const tabs: { key: TabType; label: string }[] = [
    { key: 'upload', label: '本地上传' },
    { key: 'url', label: 'URL 链接' },
    { key: 'gallery', label: '图片库' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">插入图片</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {/* Upload tab */}
          {tab === 'upload' && (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-gray-500">上传中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-600">拖拽图片到此处，或点击选择文件</p>
                    <p className="text-xs text-gray-400">支持 JPEG、PNG、GIF、WebP，最大 10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* URL tab */}
          {tab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图片 URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlInsert()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">替代文本 (alt)</label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="图片描述..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlInsert()}
                />
              </div>
              {/* Preview */}
              {urlInput.trim() && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-2">预览</p>
                  <img
                    src={urlInput}
                    alt={altText || '预览'}
                    className="max-h-40 rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleUrlInsert}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  插入图片
                </button>
              </div>
            </div>
          )}

          {/* Gallery tab */}
          {tab === 'gallery' && (
            <div>
              {!documentId ? (
                <p className="text-sm text-gray-400 text-center py-8">保存文档后可使用图片库</p>
              ) : !images || images.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">暂无图片，上传图片后将在此显示</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => handleGallerySelect(img)}
                      className="group relative border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                    >
                      <div className="aspect-square bg-gray-100">
                        <img
                          src={getImageFullUrl(img.url)}
                          alt={img.originalName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-xs text-gray-600 truncate" title={img.originalName}>
                          {img.originalName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(img.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteImage(e, img.id)}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="删除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
