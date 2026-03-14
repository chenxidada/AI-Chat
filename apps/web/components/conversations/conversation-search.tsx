'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SearchFilters {
  mode?: string;
  isPinned?: boolean;
  isStarred?: boolean;
}

interface ConversationSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
}

export function ConversationSearch({ onSearch }: ConversationSearchProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<string>('all');
  const [filter, setFilter] = useState<string>('all');

  const buildFilters = (modeVal: string, filterVal: string): SearchFilters => {
    const filters: SearchFilters = {};
    if (modeVal !== 'all') filters.mode = modeVal;
    if (filterVal === 'pinned') filters.isPinned = true;
    if (filterVal === 'starred') filters.isStarred = true;
    return filters;
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Debounce search
    setTimeout(() => {
      onSearch(value, buildFilters(mode, filter));
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('', {});
  };

  const handleModeChange = (v: string) => {
    setMode(v);
    onSearch(query, buildFilters(v, filter));
  };

  const handleFilterChange = (v: string) => {
    setFilter(v);
    onSearch(query, buildFilters(mode, v));
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="搜索对话标题或内容..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQueryChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Select value={mode} onValueChange={handleModeChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="模式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部模式</SelectItem>
          <SelectItem value="general">通用</SelectItem>
          <SelectItem value="knowledge_base">知识库</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filter} onValueChange={handleFilterChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="筛选" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="pinned">已置顶</SelectItem>
          <SelectItem value="starred">已星标</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
