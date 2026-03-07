'use client';

import { useTags } from '@/hooks/use-tags';
import { useAppStore } from '@/stores/app-store';
import { TagBadge } from './tag-badge';

export function TagList() {
  const { data: tags, isLoading } = useTags();
  const { activeTagId, setActiveTagId } = useAppStore();

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!tags || tags.length === 0) {
    return <p className="text-xs text-gray-400 px-2 py-2">暂无标签</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
          className="transition-transform hover:scale-105"
        >
          <TagBadge
            name={tag.name}
            color={tag.color}
            count={tag._count.documents}
            active={activeTagId === tag.id}
          />
        </button>
      ))}
    </div>
  );
}
