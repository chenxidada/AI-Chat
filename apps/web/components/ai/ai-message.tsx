'use client';

import { useState } from 'react';
import { CitationBadge } from './citation-badge';
import { CitationPopover } from './citation-popover';

interface Citation {
  id: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}

interface AIMessageProps {
  content: string;
  citations?: Citation[];
  isLoading?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

export function AIMessage({
  content,
  citations = [],
  isLoading,
  onCitationClick,
}: AIMessageProps) {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);

  // 渲染带引用标记的内容
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-gray-400">AI 正在思考...</span>
        </div>
      );
    }

    // 分割内容，将 [1][2] 等引用标记转为组件
    const parts = content.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const citationNumber = parseInt(match[1]);
        const citation = citations[citationNumber - 1];

        if (citation) {
          return (
            <CitationBadge
              key={index}
              number={citationNumber}
              onClick={(e) => {
                setActiveCitation(citation);
                setPopoverAnchor(e.currentTarget as HTMLElement);
              }}
            />
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none">
          {isLoading ? (
            renderContent()
          ) : (
            <>
              <div className="whitespace-pre-wrap">{renderContent()}</div>

              {/* 引用来源列表 */}
              {citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">引用来源：</div>
                  <div className="flex flex-wrap gap-2">
                    {citations.map((citation, index) => (
                      <CitationBadge
                        key={citation.id}
                        number={index + 1}
                        title={citation.documentTitle}
                        onClick={() => onCitationClick?.(citation)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 引用预览弹窗 */}
      {activeCitation && popoverAnchor && (
        <CitationPopover
          citation={activeCitation}
          anchor={popoverAnchor}
          onClose={() => {
            setActiveCitation(null);
            setPopoverAnchor(null);
          }}
          onOpenDocument={() => {
            onCitationClick?.(activeCitation);
            setActiveCitation(null);
            setPopoverAnchor(null);
          }}
        />
      )}
    </div>
  );
}
