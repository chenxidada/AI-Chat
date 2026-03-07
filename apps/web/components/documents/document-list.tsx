'use client';

import Link from 'next/link';
import type { Document } from '@/hooks/use-documents';
import { useDeleteDocument, useArchiveDocument } from '@/hooks/use-documents';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatRelativeTime, truncate } from '@/lib/utils';

interface DocumentListProps {
  documents: Document[];
  viewMode: 'list' | 'grid';
}

export function DocumentList({ documents, viewMode }: DocumentListProps) {
  const deleteDocument = useDeleteDocument();
  const archiveDocument = useArchiveDocument();

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">暂无文档</p>
        <Link href="/documents/new" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
          创建第一篇文档
        </Link>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} onDelete={deleteDocument} onArchive={archiveDocument} />
      ))}
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
  onArchive,
}: {
  doc: Document;
  onDelete: ReturnType<typeof useDeleteDocument>;
  onArchive: ReturnType<typeof useArchiveDocument>;
}) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`确定永久删除"${doc.title}"？`)) {
      onDelete.mutate(doc.id);
    }
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onArchive.mutate(doc.id);
  };

  return (
    <Link
      href={`/documents/${doc.id}`}
      className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors group"
    >
      {/* Doc icon */}
      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>

      {/* Title + preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{doc.title}</span>
          {doc.isArchived && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">已归档</span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate mt-0.5">
          {truncate(doc.contentPlain || '空文档', 80)}
        </p>
      </div>

      {/* Tags */}
      <div className="hidden md:flex items-center gap-1 shrink-0">
        {doc.tags.slice(0, 3).map((tag) => (
          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
        ))}
        {doc.tags.length > 3 && (
          <span className="text-xs text-gray-400">+{doc.tags.length - 3}</span>
        )}
      </div>

      {/* Metadata */}
      <div className="hidden sm:flex flex-col items-end text-xs text-gray-400 shrink-0 w-24">
        <span>{formatRelativeTime(doc.updatedAt)}</span>
        <span>{doc.wordCount} 字</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={handleArchive}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          title={doc.isArchived ? '取消归档' : '归档'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
          title="删除"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </Link>
  );
}

function DocumentCard({
  doc,
}: {
  doc: Document;
}) {
  return (
    <Link
      href={`/documents/${doc.id}`}
      className="block p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 truncate flex-1">{doc.title}</h3>
      </div>
      <p className="text-sm text-gray-500 line-clamp-3 mb-3">
        {truncate(doc.contentPlain || '空文档', 120)}
      </p>
      <div className="flex flex-wrap gap-1 mb-2">
        {doc.tags.slice(0, 3).map((tag) => (
          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{formatRelativeTime(doc.updatedAt)}</span>
        <span>{doc.wordCount} 字</span>
      </div>
    </Link>
  );
}
