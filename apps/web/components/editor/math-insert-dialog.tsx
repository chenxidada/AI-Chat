'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EditorHandle } from './codemirror-editor';
import { insertTemplate } from './editor-commands';

interface MathInsertDialogProps {
  open: boolean;
  onClose: () => void;
  editorRef: React.RefObject<EditorHandle | null>;
}

const MATH_TEMPLATES = [
  { label: '分式', latex: '\\frac{a}{b}' },
  { label: '求和', latex: '\\sum_{i=1}^{n} x_i' },
  { label: '积分', latex: '\\int_{a}^{b} f(x) \\, dx' },
  { label: '极限', latex: '\\lim_{x \\to \\infty} f(x)' },
  { label: '平方根', latex: '\\sqrt{x}' },
  { label: '上下标', latex: 'x^{2} + y_{1}' },
  { label: '矩阵', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: '希腊字母', latex: '\\alpha, \\beta, \\gamma, \\theta, \\pi' },
  { label: '不等式', latex: 'a \\leq b \\leq c' },
  { label: '对数', latex: '\\log_{2}(x)' },
];

export function MathInsertDialog({ open, onClose, editorRef }: MathInsertDialogProps) {
  const [latex, setLatex] = useState('');
  const [isBlock, setIsBlock] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Render KaTeX preview
  useEffect(() => {
    if (!latex.trim()) {
      setPreviewHtml('');
      return;
    }
    // Dynamic import to avoid SSR issues
    import('katex').then((katex) => {
      try {
        const html = katex.default.renderToString(latex, {
          throwOnError: false,
          displayMode: isBlock,
        });
        setPreviewHtml(html);
      } catch {
        setPreviewHtml('<span style="color: red;">公式语法错误</span>');
      }
    });
  }, [latex, isBlock]);

  const handleInsert = useCallback(() => {
    const view = editorRef.current?.getView();
    if (!view || !latex.trim()) return;

    const text = isBlock ? `$$\n${latex}\n$$` : `$${latex}$`;
    insertTemplate(view, text);
    onClose();
    setLatex('');
  }, [latex, isBlock, editorRef, onClose]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">插入数学公式</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-4 p-5">
          {/* Templates */}
          <div className="w-1/3 space-y-1 max-h-[300px] overflow-auto">
            <div className="text-xs text-gray-400 font-medium mb-2">常用模板</div>
            {MATH_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setLatex(t.latex)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-gray-700 truncate"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Editor + Preview */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">LaTeX 公式</label>
              <textarea
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                placeholder="输入 LaTeX 公式，如 E=mc^2"
                className="w-full h-24 px-3 py-2 text-sm font-mono border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                autoFocus
              />
            </div>

            {/* Preview */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">预览</label>
              <div
                className="min-h-[60px] px-3 py-3 bg-gray-50 rounded-md flex items-center justify-center border border-gray-200"
                dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="text-gray-300 text-sm">输入公式后显示预览</span>' }}
              />
            </div>

            {/* Options */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={isBlock}
                  onChange={(e) => setIsBlock(e.target.checked)}
                  className="rounded border-gray-300"
                />
                块级公式（独占一行，居中显示）
              </label>

              <button
                onClick={handleInsert}
                disabled={!latex.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                插入
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
