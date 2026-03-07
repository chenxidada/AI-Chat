'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSearch, type SearchHit } from '@/hooks/use-search';
import { Pagination } from '@/components/ui/pagination';

function HighlightedText({ html }: { html: string }) {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className="[&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 [&>mark]:rounded-sm [&>mark]:px-0.5"
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto py-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-4 rounded-lg bg-gray-50 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSearch(query, { page, limit: 20 });

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="搜索文档..."
              className="flex-1 text-lg text-gray-900 placeholder-gray-400 outline-none bg-transparent"
              autoFocus
            />
          </div>
          {data && query && (
            <div className="mt-2 text-sm text-gray-500">
              找到 {data.estimatedTotalHits} 个结果 ({data.processingTimeMs}ms)
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto py-4">
          {!query && (
            <div className="py-20 text-center text-gray-400">
              输入关键词开始搜索
            </div>
          )}

          {query && isLoading && (
            <div className="py-10 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-6 py-4 rounded-lg bg-gray-50 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {query && !isLoading && data && data.hits.length === 0 && (
            <div className="py-20 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>未找到与 &quot;{query}&quot; 相关的文档</p>
            </div>
          )}

          {data && data.hits.length > 0 && (
            <>
              <div className="space-y-2">
                {data.hits.map((hit) => (
                  <SearchResultCard key={hit.id} hit={hit} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={Math.ceil(data.estimatedTotalHits / 20)}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchResultCard({ hit }: { hit: SearchHit }) {
  const updatedDate = new Date(hit.updatedAt * 1000);
  const timeStr = updatedDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link
      href={`/documents/${hit.id}`}
      className="block px-6 py-4 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
    >
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="font-medium text-gray-900">
          <HighlightedText html={hit._formatted.title} />
        </span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-3 pl-6 mb-2">
        <HighlightedText html={hit._formatted.contentPlain} />
      </p>
      <div className="flex items-center gap-3 pl-6 text-xs text-gray-400">
        {hit.folderName && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            {hit.folderName}
          </span>
        )}
        {hit.tags.slice(0, 3).map((tag, i) => (
          <span key={i}>#{tag}</span>
        ))}
        <span className="ml-auto">{timeStr}</span>
        <span>{hit.wordCount} 字</span>
      </div>
    </Link>
  );
}
