'use client';

import { cn } from '@/lib/utils';

interface CitationBadgeProps {
  number: number;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function CitationBadge({
  number,
  title,
  onClick,
  className,
}: CitationBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center',
        'w-5 h-5 text-xs font-medium',
        'bg-blue-100 text-blue-700',
        'rounded-full hover:bg-blue-200',
        'transition-colors cursor-pointer',
        className,
      )}
      title={title}
    >
      {number}
    </button>
  );
}
