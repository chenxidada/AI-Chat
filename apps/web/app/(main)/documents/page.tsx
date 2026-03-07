'use client';

import { useState } from 'react';
import { useDocuments } from '@/hooks/use-documents';
import { useAppStore } from '@/stores/app-store';
import { DocumentList } from '@/components/documents/document-list';
import { DocumentToolbar } from '@/components/documents/document-toolbar';
import { Pagination } from '@/components/ui/pagination';

export default function DocumentsPage() {
  const [page, setPage] = useState(1);
  const { activeFolderId, activeTagId, viewMode, sortBy, sortOrder } = useAppStore();

  const { data, isLoading } = useDocuments({
    page,
    limit: 20,
    folderId: activeFolderId,
    tagId: activeTagId,
    sortBy,
    sortOrder,
  });

  return (
    <div className="flex flex-col h-full">
      <DocumentToolbar />

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <DocumentList
              documents={data?.items ?? []}
              viewMode={viewMode}
            />
            {data && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
