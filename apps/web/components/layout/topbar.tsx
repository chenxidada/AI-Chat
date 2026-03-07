'use client';

import { useAppStore } from '@/stores/app-store';
import { useRouter } from 'next/navigation';

export function TopBar() {
  const { toggleSidebar, sidebarOpen } = useAppStore();
  const router = useRouter();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Sidebar toggle */}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-lg font-semibold text-gray-900">文档管理</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* New document button */}
        <button
          onClick={() => router.push('/documents/new')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建文档
        </button>
      </div>
    </header>
  );
}
