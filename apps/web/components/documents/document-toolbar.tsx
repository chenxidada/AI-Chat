'use client';

import { useAppStore } from '@/stores/app-store';

export function DocumentToolbar() {
  const { viewMode, setViewMode, sortBy, setSortBy, sortOrder, setSortOrder } = useAppStore();

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3">
        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="updatedAt">最近更新</option>
          <option value="createdAt">创建时间</option>
          <option value="title">标题</option>
          <option value="wordCount">字数</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
          title={sortOrder === 'desc' ? '降序' : '升序'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sortOrder === 'desc' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            )}
          </svg>
        </button>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          title="列表视图"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          title="网格视图"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
