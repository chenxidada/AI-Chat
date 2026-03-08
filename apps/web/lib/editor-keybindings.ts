export interface KeyBindingDef {
  id: string;
  key: string;       // Windows/Linux key
  macKey: string;     // Mac key
  description: string;
  group: string;
}

export const KEYBINDING_GROUPS = {
  basic: '基础操作',
  format: '格式化',
  search: '查找替换',
  multicursor: '多光标',
  view: '视图',
} as const;

export const DEFAULT_KEYBINDINGS: KeyBindingDef[] = [
  // Basic
  { id: 'save', key: 'Ctrl-s', macKey: 'Cmd-s', description: '保存文档', group: 'basic' },
  { id: 'undo', key: 'Ctrl-z', macKey: 'Cmd-z', description: '撤销', group: 'basic' },
  { id: 'redo', key: 'Ctrl-Shift-z', macKey: 'Cmd-Shift-z', description: '重做', group: 'basic' },
  { id: 'selectAll', key: 'Ctrl-a', macKey: 'Cmd-a', description: '全选', group: 'basic' },

  // Format
  { id: 'bold', key: 'Ctrl-b', macKey: 'Cmd-b', description: '粗体', group: 'format' },
  { id: 'italic', key: 'Ctrl-i', macKey: 'Cmd-i', description: '斜体', group: 'format' },
  { id: 'strikethrough', key: 'Ctrl-Shift-s', macKey: 'Cmd-Shift-s', description: '删除线', group: 'format' },
  { id: 'inlineCode', key: 'Ctrl-e', macKey: 'Cmd-e', description: '行内代码', group: 'format' },
  { id: 'heading1', key: 'Ctrl-1', macKey: 'Cmd-1', description: '一级标题', group: 'format' },
  { id: 'heading2', key: 'Ctrl-2', macKey: 'Cmd-2', description: '二级标题', group: 'format' },
  { id: 'heading3', key: 'Ctrl-3', macKey: 'Cmd-3', description: '三级标题', group: 'format' },
  { id: 'link', key: 'Ctrl-k', macKey: 'Cmd-k', description: '插入链接', group: 'format' },

  // Search
  { id: 'find', key: 'Ctrl-f', macKey: 'Cmd-f', description: '查找', group: 'search' },
  { id: 'replace', key: 'Ctrl-h', macKey: 'Cmd-h', description: '查找替换', group: 'search' },
  { id: 'findNext', key: 'Ctrl-g', macKey: 'Cmd-g', description: '查找下一个', group: 'search' },
  { id: 'findPrev', key: 'Ctrl-Shift-g', macKey: 'Cmd-Shift-g', description: '查找上一个', group: 'search' },

  // Multi-cursor
  { id: 'selectNext', key: 'Ctrl-d', macKey: 'Cmd-d', description: '选中下一个相同词', group: 'multicursor' },
  { id: 'addCursor', key: 'Alt-Click', macKey: 'Alt-Click', description: '添加光标', group: 'multicursor' },
  { id: 'rectSelect', key: 'Alt-Shift-拖动', macKey: 'Alt-Shift-拖动', description: '矩形选择', group: 'multicursor' },

  // View
  { id: 'shortcuts', key: 'Ctrl-/', macKey: 'Cmd-/', description: '快捷键参考', group: 'view' },
];

export function getKeybindingsForDisplay(): Record<string, KeyBindingDef[]> {
  const grouped: Record<string, KeyBindingDef[]> = {};
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  for (const kb of DEFAULT_KEYBINDINGS) {
    if (!grouped[kb.group]) grouped[kb.group] = [];
    grouped[kb.group].push({
      ...kb,
      // Normalize display: show appropriate key for platform
      key: isMac ? kb.macKey : kb.key,
    });
  }

  return grouped;
}

export function formatKeyDisplay(key: string): string {
  return key
    .replace('Ctrl', '⌃')
    .replace('Cmd', '⌘')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/-/g, ' + ');
}
