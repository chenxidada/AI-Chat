'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { FolderTree } from '@/components/folders/folder-tree';
import { TagList } from '@/components/tags/tag-list';
import { CreateFolderDialog } from '@/components/folders/create-folder-dialog';
import { ManageTagDialog } from '@/components/tags/manage-tag-dialog';

export function Sidebar() {
  const { sidebarOpen } = useAppStore();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showManageTag, setShowManageTag] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <aside
        className={cn(
          'h-full bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden',
          sidebarOpen ? 'w-[280px] min-w-[280px]' : 'w-0 min-w-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 shrink-0">
          <span className="text-xl font-bold text-gray-900">KB</span>
          <span className="text-sm text-gray-500">知识库</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* AI 对话入口 */}
          <div className="px-3 pt-4 pb-2">
            <Link
              href="/conversations/new"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                pathname.startsWith('/conversations')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-200'
              )}
            >
              <span className="text-lg">💬</span>
              <span className="text-sm font-medium">AI 对话</span>
            </Link>
          </div>

          {/* Folders Section */}
          <div className="px-3 pt-4 pb-2 border-t border-gray-200 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">文件夹</span>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
                title="新建文件夹"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <FolderTree />
          </div>

          {/* Tags Section */}
          <div className="px-3 pt-2 pb-4 border-t border-gray-200 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">标签</span>
              <button
                onClick={() => setShowManageTag(true)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
                title="管理标签"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <TagList />
          </div>
        </div>
      </aside>

      {showCreateFolder && (
        <CreateFolderDialog onClose={() => setShowCreateFolder(false)} />
      )}
      {showManageTag && (
        <ManageTagDialog onClose={() => setShowManageTag(false)} />
      )}
    </>
  );
}
