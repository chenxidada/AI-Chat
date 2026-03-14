'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface MarkdownPreviewProps {
  content: string;
}

// 初始化 mermaid
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 查找所有 mermaid 代码块并渲染
    const mermaidBlocks = containerRef.current.querySelectorAll('code.language-mermaid');
    
    mermaidBlocks.forEach(async (block, index) => {
      const code = block.textContent || '';
      const id = `mermaid-${index}`;
      
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

  return (
    <div ref={containerRef}>
      <article className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-blue-600 prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeHighlight, rehypeKatex]}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
