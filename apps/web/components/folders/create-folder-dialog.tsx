'use client';

import { useState } from 'react';
import { useCreateFolder } from '@/hooks/use-folders';
import { useAppStore } from '@/stores/app-store';

interface CreateFolderDialogProps {
  onClose: () => void;
  parentId?: string;
}

export function CreateFolderDialog({ onClose, parentId }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const createFolder = useCreateFolder();
  const { activeFolderId } = useAppStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createFolder.mutate(
      { name: name.trim(), parentId: parentId ?? activeFolderId ?? undefined },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[400px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">新建文件夹</h2>
        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入文件夹名称..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
            maxLength={255}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createFolder.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createFolder.isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
