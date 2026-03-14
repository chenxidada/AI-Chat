'use client';

import { useState, ReactNode, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';
import { CitationBadge } from './citation-badge';
import { CitationPopover } from './citation-popover';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

// 初始化 mermaid
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
}

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
  const containerRef = useRef<HTMLDivElement>(null);

  // 渲染 mermaid 图表
  useEffect(() => {
    if (!containerRef.current) return;

    const mermaidBlocks = containerRef.current.querySelectorAll('code.language-mermaid');
    
    mermaidBlocks.forEach(async (block, index) => {
      const code = block.textContent || '';
      const id = `mermaid-ai-${index}-${Date.now()}`;
      
      try {
        const { svg } = await mermaid.render(id, code);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        block.parentElement?.replaceWith(wrapper);
      } catch (error) {
        console.error('Mermaid render error:', error);
      }
    });
  }, [content]);

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-gray-400">AI 正在思考...</span>
        </div>
      </div>
    );
  }

  // 处理引用标记，将其转换为特殊标记
  const processContent = (text: string) => {
    return text.replace(/\[(\d+)\]/g, '___CITATION_$1___');
  };

  // 自定义文本渲染器，处理引用标记
  const CustomText = ({ children }: { children?: ReactNode }) => {
    if (typeof children === 'string') {
      const parts = children.split(/___CITATION_(\d+)___/g);

      return (
        <>
          {parts.map((part, index) => {
            if (index % 2 === 1) {
              const citationNumber = parseInt(part);
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
              return null;
            }
            return <span key={index}>{part}</span>;
          })}
        </>
      );
    }
    return <>{children}</>;
  };

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* 消息内容 */}
      <div ref={containerRef} className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={{
              // 处理纯文本节点
              text: CustomText as any,
            }}
          >
            {processContent(content)}
          </ReactMarkdown>

          {/* 引用来源列表 */}
          {citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 not-prose">
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
