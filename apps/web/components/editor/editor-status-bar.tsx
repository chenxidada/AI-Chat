'use client';

import type { AutoSaveStatus } from '@/hooks/use-auto-save';
import { formatSaveStatus } from '@/hooks/use-auto-save';

type ViewMode = 'edit' | 'preview' | 'split';

interface EditorStatusBarProps {
  wordCount: number;
  saveStatus: AutoSaveStatus;
  cursorLine: number;
  cursorCol: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  edit: '编辑',
  preview: '预览',
  split: '分屏',
};

export function EditorStatusBar({
  wordCount,
  saveStatus,
  cursorLine,
  cursorCol,
  viewMode,
  onViewModeChange,
}: EditorStatusBarProps) {
  const saveText = formatSaveStatus(saveStatus);

  return (
    <div className="flex items-center justify-between px-4 py-1 border-t border-gray-200 bg-gray-50/80 text-xs text-gray-500 shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span>{wordCount.toLocaleString()} 字</span>
        <span
          className={
            saveStatus.status === 'error'
              ? 'text-red-500'
              : saveStatus.status === 'saving'
              ? 'text-blue-500'
              : ''
          }
        >
          {saveText}
        </span>
        <span>
          Ln {cursorLine}, Col {cursorCol}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              viewMode === mode
                ? 'bg-gray-200 text-gray-800 font-medium'
                : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            {VIEW_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
