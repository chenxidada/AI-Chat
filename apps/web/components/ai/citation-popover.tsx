'use client';

import { useEffect, useRef } from 'react';

interface Citation {
  id: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}

interface CitationPopoverProps {
  citation: Citation;
  anchor: HTMLElement;
  onClose: () => void;
  onOpenDocument: () => void;
}

export function CitationPopover({
  citation,
  anchor,
  onClose,
  onOpenDocument,
}: CitationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // 计算位置
  useEffect(() => {
    if (!popoverRef.current || !anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popover = popoverRef.current;

    // 显示在锚点上方
    popover.style.left = `${anchorRect.left}px`;
    popover.style.top = `${anchorRect.top - popover.offsetHeight - 8}px`;
  }, [anchor]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border p-3"
    >
      {/* 文档标题 */}
      <div className="font-medium text-sm mb-2 truncate">
        {citation.documentTitle}
      </div>

      {/* 摘要 */}
      <div className="text-xs text-gray-600 mb-3 line-clamp-3">
        {citation.excerpt}
      </div>

      {/* 相似度 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>相似度: {(citation.similarity * 100).toFixed(1)}%</span>
        <button
          onClick={onOpenDocument}
          className="text-blue-500 hover:text-blue-600"
        >
          查看原文 →
        </button>
      </div>
    </div>
  );
}
