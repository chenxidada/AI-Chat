'use client';

import { useState, useEffect } from 'react';
import {
  getKeybindingsForDisplay,
  formatKeyDisplay,
  KEYBINDING_GROUPS,
} from '@/lib/editor-keybindings';

interface ShortcutPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutPanel({ open, onClose }: ShortcutPanelProps) {
  const [grouped] = useState(() => getKeybindingsForDisplay());

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">快捷键参考</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto p-5 space-y-5 max-h-[calc(80vh-56px)]">
          {Object.entries(KEYBINDING_GROUPS).map(([groupKey, groupLabel]) => {
            const items = grouped[groupKey];
            if (!items?.length) return null;

            return (
              <div key={groupKey}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {groupLabel}
                </h3>
                <div className="space-y-1">
                  {items.map((kb) => (
                    <div
                      key={kb.id}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-gray-700">{kb.description}</span>
                      <kbd className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-mono">
                        {formatKeyDisplay(kb.key)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
