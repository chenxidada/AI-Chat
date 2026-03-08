'use client';

import { useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface TableContextMenuProps {
  position: Position | null;
  onClose: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  canDeleteRow: boolean;
  canDeleteCol: boolean;
}

export function TableContextMenu({
  position,
  onClose,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColLeft,
  onInsertColRight,
  onDeleteRow,
  onDeleteCol,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  canDeleteRow,
  canDeleteCol,
}: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [position, onClose]);

  useEffect(() => {
    if (!position) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [position, onClose]);

  if (!position) return null;

  const MenuItem = ({
    onClick,
    disabled = false,
    children,
  }: {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => {
        if (!disabled) {
          onClick();
          onClose();
        }
      }}
      disabled={disabled}
      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <MenuItem onClick={onInsertRowAbove}>在上方插入行</MenuItem>
      <MenuItem onClick={onInsertRowBelow}>在下方插入行</MenuItem>
      <div className="h-px bg-gray-200 my-1" />
      <MenuItem onClick={onInsertColLeft}>在左侧插入列</MenuItem>
      <MenuItem onClick={onInsertColRight}>在右侧插入列</MenuItem>
      <div className="h-px bg-gray-200 my-1" />
      <MenuItem onClick={onDeleteRow} disabled={!canDeleteRow}>
        删除当前行
      </MenuItem>
      <MenuItem onClick={onDeleteCol} disabled={!canDeleteCol}>
        删除当前列
      </MenuItem>
      <div className="h-px bg-gray-200 my-1" />
      <MenuItem onClick={onAlignLeft}>左对齐</MenuItem>
      <MenuItem onClick={onAlignCenter}>居中对齐</MenuItem>
      <MenuItem onClick={onAlignRight}>右对齐</MenuItem>
    </div>
  );
}
