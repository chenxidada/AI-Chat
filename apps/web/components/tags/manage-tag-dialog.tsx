'use client';

import { useState } from 'react';
import { useTags, useCreateTag, useDeleteTag, useUpdateTag } from '@/hooks/use-tags';
import { TagBadge } from './tag-badge';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

interface ManageTagDialogProps {
  onClose: () => void;
}

export function ManageTagDialog({ onClose }: ManageTagDialogProps) {
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const updateTag = useUpdateTag();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createTag.mutate(
      { name: newName.trim(), color: newColor },
      { onSuccess: () => setNewName('') }
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定删除标签"${name}"？`)) {
      deleteTag.mutate(id);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      updateTag.mutate({ id, name: editName.trim() });
    }
    setEditId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[460px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">管理标签</h2>
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新建标签名称..."
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={100}
            />
            <button
              type="submit"
              disabled={!newName.trim() || createTag.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              添加
            </button>
          </div>
          <div className="flex gap-1.5 mt-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  newColor === c ? 'border-gray-800 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </form>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {tags && tags.length > 0 ? (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between py-1.5 group">
                  {editId === tag.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(tag.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(tag.id);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                      className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm outline-none"
                      autoFocus
                    />
                  ) : (
                    <TagBadge name={tag.name} color={tag.color} count={tag._count.documents} />
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditId(tag.id);
                        setEditName(tag.name);
                      }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="重命名"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id, tag.name)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                      title="删除"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">暂无标签</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
