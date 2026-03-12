'use client';

import { useState } from 'react';
import { useFolders } from '@/hooks/use-folders';
import { useTags } from '@/hooks/use-tags';
import { useDocuments } from '@/hooks/use-documents';

interface ConversationContext {
  documentIds: string[];
  folderId: string | null;
  tagIds: string[];
}

interface ContextSelectorProps {
  value: ConversationContext;
  onChange: (context: ConversationContext) => void;
}

type ScopeType = 'all' | 'folder' | 'tags' | 'documents';

export function ContextSelector({ value, onChange }: ContextSelectorProps) {
  const [scopeType, setScopeType] = useState<ScopeType>('all');

  const { data: folders } = useFolders();
  const { data: tags } = useTags();
  const { data: documents } = useDocuments({ limit: 100 });

  const handleScopeChange = (type: ScopeType) => {
    setScopeType(type);
    if (type === 'all') {
      onChange({ documentIds: [], folderId: null, tagIds: [] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">知识范围</div>

      {/* 范围类型选择 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { type: 'all', label: '全部文档' },
          { type: 'folder', label: '文件夹' },
          { type: 'tags', label: '标签' },
          { type: 'documents', label: '选择文档' },
        ].map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handleScopeChange(type as ScopeType)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              scopeType === type
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 具体选择 */}
      {scopeType === 'folder' && folders && (
        <select
          value={value.folderId || ''}
          onChange={(e) =>
            onChange({ ...value, folderId: e.target.value || null })
          }
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">选择文件夹</option>
          {folders.map((f: any) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      {scopeType === 'tags' && tags && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag: any) => (
            <button
              key={tag.id}
              onClick={() => {
                const currentIds = value.tagIds || [];
                const newIds = currentIds.includes(tag.id)
                  ? currentIds.filter((id) => id !== tag.id)
                  : [...currentIds, tag.id];
                onChange({ ...value, tagIds: newIds });
              }}
              className={`px-2 py-1 text-xs rounded ${
                value.tagIds?.includes(tag.id)
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={{
                backgroundColor: value.tagIds?.includes(tag.id)
                  ? tag.color
                  : undefined,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {scopeType === 'documents' && documents?.items && (
        <div className="max-h-40 overflow-y-auto border rounded-md">
          {documents.items.map((doc: any) => (
            <label
              key={doc.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.documentIds?.includes(doc.id)}
                onChange={(e) => {
                  const currentIds = value.documentIds || [];
                  const newIds = e.target.checked
                    ? [...currentIds, doc.id]
                    : currentIds.filter((id) => id !== doc.id);
                  onChange({ ...value, documentIds: newIds });
                }}
              />
              <span className="text-sm truncate">{doc.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
