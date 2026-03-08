'use client';

import { useState } from 'react';
import type { EditorHandle } from './codemirror-editor';
import {
  wrapSelection,
  wrapLine,
  insertTemplate,
  insertLink,
  insertCodeBlock,
  insertImage,
} from './editor-commands';
import { createEmptyTable } from './table-editor/table-parser';

interface EditorToolbarProps {
  editorRef: React.RefObject<EditorHandle | null>;
  onMathInsert?: () => void;
  onImageInsert?: () => void;
}

type ToolbarItem =
  | { type: 'button'; id: string; icon: React.ReactNode; label: string; shortcut?: string; action: () => void }
  | { type: 'separator' };

export function EditorToolbar({ editorRef, onMathInsert, onImageInsert }: EditorToolbarProps) {
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const getView = () => editorRef.current?.getView() ?? null;

  const handleTableInsert = (rows: number, cols: number) => {
    const v = getView();
    if (v) {
      insertTemplate(v, createEmptyTable(rows, cols));
    }
    setShowTablePicker(false);
  };

  const items: ToolbarItem[] = [
    // Headings
    {
      type: 'button', id: 'h1', label: '一级标题', shortcut: 'Ctrl+1',
      icon: <span className="font-bold text-xs">H1</span>,
      action: () => { const v = getView(); if (v) wrapLine(v, '# '); },
    },
    {
      type: 'button', id: 'h2', label: '二级标题', shortcut: 'Ctrl+2',
      icon: <span className="font-bold text-xs">H2</span>,
      action: () => { const v = getView(); if (v) wrapLine(v, '## '); },
    },
    {
      type: 'button', id: 'h3', label: '三级标题', shortcut: 'Ctrl+3',
      icon: <span className="font-bold text-xs">H3</span>,
      action: () => { const v = getView(); if (v) wrapLine(v, '### '); },
    },
    { type: 'separator' },
    // Text format
    {
      type: 'button', id: 'bold', label: '粗体', shortcut: 'Ctrl+B',
      icon: <span className="font-bold">B</span>,
      action: () => { const v = getView(); if (v) wrapSelection(v, '**', '**'); },
    },
    {
      type: 'button', id: 'italic', label: '斜体', shortcut: 'Ctrl+I',
      icon: <span className="italic">I</span>,
      action: () => { const v = getView(); if (v) wrapSelection(v, '*', '*'); },
    },
    {
      type: 'button', id: 'strikethrough', label: '删除线',
      icon: <span className="line-through">S</span>,
      action: () => { const v = getView(); if (v) wrapSelection(v, '~~', '~~'); },
    },
    {
      type: 'button', id: 'inlineCode', label: '行内代码', shortcut: 'Ctrl+E',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>,
      action: () => { const v = getView(); if (v) wrapSelection(v, '`', '`'); },
    },
    { type: 'separator' },
    // Lists
    {
      type: 'button', id: 'ul', label: '无序列表',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
      action: () => { const v = getView(); if (v) wrapLine(v, '- '); },
    },
    {
      type: 'button', id: 'ol', label: '有序列表',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 6h11M10 12h11M10 18h11M3 5v2h3V5H3zM3 17v2h3v-2H3zM3 11v2h3v-2H3z" /></svg>,
      action: () => { const v = getView(); if (v) wrapLine(v, '1. '); },
    },
    {
      type: 'button', id: 'task', label: '任务列表',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 12l2 2 4-4" /></svg>,
      action: () => { const v = getView(); if (v) wrapLine(v, '- [ ] '); },
    },
    { type: 'separator' },
    // Insert
    {
      type: 'button', id: 'link', label: '链接', shortcut: 'Ctrl+K',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>,
      action: () => { const v = getView(); if (v) insertLink(v); },
    },
    {
      type: 'button', id: 'codeBlock', label: '代码块', shortcut: 'Ctrl+Shift+C',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10l-2 2 2 2M16 10l2 2-2 2M13 7l-2 10" /></svg>,
      action: () => { const v = getView(); if (v) insertCodeBlock(v); },
    },
    {
      type: 'button', id: 'quote', label: '引用',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" /></svg>,
      action: () => { const v = getView(); if (v) wrapLine(v, '> '); },
    },
    {
      type: 'button', id: 'hr', label: '分隔线',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12h18" /></svg>,
      action: () => { const v = getView(); if (v) insertTemplate(v, '\n---\n'); },
    },
    // Table (special: has picker dropdown)
    {
      type: 'button', id: 'table', label: '表格',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>,
      action: () => setShowTablePicker((v) => !v),
    },
    { type: 'separator' },
    // Math
    {
      type: 'button', id: 'math', label: '数学公式',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 4l6 8-6 8M12 20h8" /></svg>,
      action: () => onMathInsert?.(),
    },
    // Image
    {
      type: 'button', id: 'image', label: '图片',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>,
      action: () => {
        if (onImageInsert) {
          onImageInsert();
        } else {
          const v = getView();
          if (v) insertImage(v);
        }
      },
    },
  ];

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-gray-50/80 overflow-x-auto shrink-0 relative">
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={`sep-${i}`} className="w-px h-5 bg-gray-300 mx-1" />;
        }
        return (
          <div key={item.id} className="relative">
            <button
              onClick={item.action}
              title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center min-w-[28px] h-7"
            >
              {item.icon}
            </button>

            {/* Table picker dropdown */}
            {item.id === 'table' && showTablePicker && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
                <div className="text-xs text-gray-500 mb-2">
                  {hoverCell ? `${hoverCell.row + 1} x ${hoverCell.col + 1}` : '选择表格尺寸'}
                </div>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                  {Array.from({ length: 6 }, (_, row) =>
                    Array.from({ length: 6 }, (_, col) => (
                      <button
                        key={`${row}-${col}`}
                        className={`w-5 h-5 border rounded-sm transition-colors ${
                          hoverCell && row <= hoverCell.row && col <= hoverCell.col
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                        }`}
                        onMouseEnter={() => setHoverCell({ row, col })}
                        onMouseLeave={() => setHoverCell(null)}
                        onClick={() => handleTableInsert(row + 1, col + 1)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Click-away for table picker */}
      {showTablePicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowTablePicker(false)}
        />
      )}
    </div>
  );
}
