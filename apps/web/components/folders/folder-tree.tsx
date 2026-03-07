'use client';

import { useFolderTree } from '@/hooks/use-folders';
import { FolderTreeItem } from './folder-tree-item';
import { useAppStore } from '@/stores/app-store';

export function FolderTree() {
  const { data: tree, isLoading } = useFolderTree();
  const { activeFolderId, setActiveFolderId } = useAppStore();

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* "All documents" option */}
      <button
        onClick={() => setActiveFolderId(null)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          activeFolderId === null
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        全部文档
      </button>

      {/* Folder tree */}
      {tree?.map((folder) => (
        <FolderTreeItem key={folder.id} folder={folder} level={0} />
      ))}

      {tree && tree.length === 0 && (
        <p className="text-xs text-gray-400 px-2 py-2">暂无文件夹</p>
      )}
    </div>
  );
}
