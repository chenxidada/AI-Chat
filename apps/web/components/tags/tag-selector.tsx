'use client';

import { useState } from 'react';
import { useTags } from '@/hooks/use-tags';
import { TagBadge } from './tag-badge';

interface TagSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagSelector({ selectedIds, onChange }: TagSelectorProps) {
  const { data: tags } = useTags();
  const [open, setOpen] = useState(false);

  const toggleTag = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((t) => t !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedTags = tags?.filter((t) => selectedIds.includes(t.id)) ?? [];

  return (
    <div className="relative">
      {/* Selected tags display */}
      <div
        className="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400"
        onClick={() => setOpen(!open)}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              name={tag.name}
              color={tag.color}
              onRemove={() => toggleTag(tag.id)}
            />
          ))
        ) : (
          <span className="text-sm text-gray-400">选择标签...</span>
        )}
      </div>

      {/* Dropdown */}
      {open && tags && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {tags.length > 0 ? (
              tags.map((tag) => {
                const selected = selectedIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                      selected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {selected && (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-gray-400">暂无标签</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
