'use client';

import { useRef, useEffect } from 'react';

interface TableCellProps {
  value: string;
  onChange: (value: string) => void;
  isHeader?: boolean;
  onTab?: (shift: boolean) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}

export function TableCell({
  value,
  onChange,
  isHeader = false,
  onTab,
  onEnter,
  autoFocus,
}: TableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onTab?.(e.shiftKey);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onEnter?.();
    }
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className={`w-full px-2 py-1 text-sm border-0 outline-none bg-transparent ${
        isHeader ? 'font-semibold text-gray-900' : 'text-gray-700'
      }`}
      placeholder={isHeader ? '表头' : ''}
    />
  );
}
