'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';
import { CitationBadge } from './citation-badge';
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

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  citations?: any[];
  onCitationClick?: (citation: any) => void;
}

export function StreamingMessage({
  content,
  isStreaming,
  citations = [],
  onCitationClick,
}: StreamingMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content, isStreaming]);

  // 渲染 mermaid 图表
  useEffect(() => {
    if (!contentRef.current || isStreaming) return;

    const mermaidBlocks = contentRef.current.querySelectorAll('code.language-mermaid');
    
    mermaidBlocks.forEach(async (block, index) => {
      const code = block.textContent || '';
      const id = `mermaid-stream-${index}-${Date.now()}`;
      
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
  }, [content, isStreaming]);

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      {/* 消息内容 */}
      <div ref={contentRef} className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
          >
            {content || '...'}
          </ReactMarkdown>

          {/* 流式指示器 */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
          )}
        </div>

        {/* 引用来源列表（流式结束后显示） */}
        {!isStreaming && citations.length > 0 && (
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
  );
}
