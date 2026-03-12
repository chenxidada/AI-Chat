'use client';

import { cn } from '@/lib/utils';

type ConversationMode = 'general' | 'knowledge_base';

interface ModeToggleProps {
  value: ConversationMode;
  onChange: (mode: ConversationMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('general')}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          value === 'general'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900',
        )}
      >
        🌐 通用对话
      </button>
      <button
        onClick={() => onChange('knowledge_base')}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          value === 'knowledge_base'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900',
        )}
      >
        📚 知识库
      </button>
    </div>
  );
}
