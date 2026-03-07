'use client';

import { useState } from 'react';
import type { Folder } from '@/hooks/use-folders';
import { useDeleteFolder, useUpdateFolder } from '@/hooks/use-folders';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';

interface FolderTreeItemProps {
  folder: Folder;
  level: number;
}

export function FolderTreeItem({ folder, level }: FolderTreeItemProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const { activeFolderId, setActiveFolderId } = useAppStore();
  const deleteFolder = useDeleteFolder();
  const updateFolder = useUpdateFolder();

  const hasChildren = folder.children && folder.children.length > 0;
  const isActive = activeFolderId === folder.id;

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      updateFolder.mutate({ id: folder.id, name: editName.trim() });
    }
    setEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定删除文件夹"${folder.name}"及其所有子文件夹？`)) {
      deleteFolder.mutate(folder.id);
      if (isActive) setActiveFolderId(null);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors',
          isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={() => setActiveFolderId(folder.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={cn('p-0.5 shrink-0', !hasChildren && 'invisible')}
        >
          <svg
            className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Folder icon */}
        <svg className="w-4 h-4 shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>

        {/* Folder name */}
        {editing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="flex-1 min-w-0 px-1 py-0 text-sm bg-white border border-blue-300 rounded outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 truncate">{folder.name}</span>
        )}

        {/* Doc count */}
        {folder._count.documents > 0 && (
          <span className="text-xs text-gray-400 shrink-0">{folder._count.documents}</span>
        )}

        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditName(folder.name);
              setEditing(true);
            }}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            title="重命名"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
            title="删除"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem key={child.id} folder={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
