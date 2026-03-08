import type { EditorView } from '@codemirror/view';

/**
 * Wrap selection with before/after markers. If no selection, inserts template with placeholder selected.
 * Supports toggle: if already wrapped, unwraps.
 */
export function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);

  // Toggle: check if selection is already wrapped
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    });
    view.focus();
    return;
  }

  // Check surrounding text for existing wrapping
  const docLen = view.state.doc.length;
  const beforeStart = Math.max(0, from - before.length);
  const afterEnd = Math.min(docLen, to + after.length);
  const textBefore = view.state.doc.sliceString(beforeStart, from);
  const textAfter = view.state.doc.sliceString(to, afterEnd);

  if (textBefore === before && textAfter === after) {
    view.dispatch({
      changes: [
        { from: beforeStart, to: from, insert: '' },
        { from: to, to: afterEnd, insert: '' },
      ],
    });
    view.focus();
    return;
  }

  // Wrap selection or insert placeholder
  const text = selected || '文本';
  view.dispatch({
    changes: { from, to, insert: before + text + after },
    selection: { anchor: from + before.length, head: from + before.length + text.length },
  });
  view.focus();
}

/**
 * Add/toggle line prefix (headings, lists, quotes).
 * For headings: cycles # → ## → ### → remove.
 */
export function wrapLine(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = line.text;

  // Heading toggle logic
  const headingMatch = prefix.match(/^(#{1,6})\s$/);
  if (headingMatch) {
    const existingMatch = lineText.match(/^(#{1,6})\s/);
    if (existingMatch) {
      // Remove existing heading prefix
      view.dispatch({
        changes: { from: line.from, to: line.from + existingMatch[0].length, insert: '' },
      });

      // If same level, just remove. If different, apply new level.
      if (existingMatch[1] === headingMatch[1]) {
        view.focus();
        return;
      }
      // Apply new level
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
      });
      view.focus();
      return;
    }
  }

  // List/quote: toggle if already has the prefix
  if (lineText.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    });
    view.focus();
    return;
  }

  // Add prefix
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  view.focus();
}

/**
 * Insert a template at cursor position.
 */
export function insertTemplate(view: EditorView, template: string) {
  const { from } = view.state.selection.main;
  view.dispatch({
    changes: { from, insert: template },
    selection: { anchor: from + template.length },
  });
  view.focus();
}

export const TABLE_TEMPLATE = `| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |`;

export const CODE_BLOCK_TEMPLATE = '```\n\n```';

export function insertCodeBlock(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);

  if (selected) {
    // Wrap selection in code block
    const text = '```\n' + selected + '\n```';
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + 4, head: from + 4 + selected.length },
    });
  } else {
    // Insert empty code block with cursor inside
    const text = '```\n\n```';
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + 4 },
    });
  }
  view.focus();
}

export function insertLink(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);

  if (selected) {
    const text = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert: text },
      // Select "url" for easy replacement
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    });
  } else {
    const text = '[链接文字](url)';
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + 1, head: from + 5 },
    });
  }
  view.focus();
}

export function insertImage(view: EditorView) {
  const { from } = view.state.selection.main;
  const text = '![描述](url)';
  view.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + 2, head: from + 4 },
  });
  view.focus();
}
