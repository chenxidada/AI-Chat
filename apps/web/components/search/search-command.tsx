'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/hooks/use-search';
import { SearchResultItem } from './search-result-item';

interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
}

export function SearchCommand({ open, onClose }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useSearch(query);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [data?.hits]);

  const navigateToDoc = useCallback(
    (id: string) => {
      onClose();
      router.push(`/documents/${id}`);
    },
    [router, onClose],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const hits = data?.hits ?? [];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < hits.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : hits.length - 1));
      } else if (e.key === 'Enter' && hits[activeIndex]) {
        e.preventDefault();
        navigateToDoc(hits[activeIndex].id);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [data, activeIndex, navigateToDoc, onClose],
  );

  // View all results
  const handleViewAll = () => {
    onClose();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Dialog */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-[560px] max-h-[60vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索文档..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 rounded border border-gray-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!query && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              输入关键词开始搜索
            </div>
          )}

          {query && isLoading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              搜索中...
            </div>
          )}

          {query && !isLoading && data && data.hits.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              未找到匹配的文档
            </div>
          )}

          {data && data.hits.length > 0 && (
            <div className="divide-y divide-gray-100">
              {data.hits.map((hit, index) => (
                <SearchResultItem
                  key={hit.id}
                  hit={hit}
                  isActive={index === activeIndex}
                  onClick={() => navigateToDoc(hit.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {data && data.hits.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-400">
            <span>
              找到 {data.estimatedTotalHits} 个结果 ({data.processingTimeMs}ms)
            </span>
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500">↑↓</kbd> 导航
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500">↵</kbd> 打开
              </span>
              <button
                onClick={handleViewAll}
                className="text-blue-600 hover:text-blue-700"
              >
                查看全部
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
