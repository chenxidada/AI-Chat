'use client';

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { autocompletion } from '@codemirror/autocomplete';
import { foldGutter } from '@codemirror/language';
import { wrapSelection, wrapLine, insertLink, insertCodeBlock } from './editor-commands';

export interface EditorHandle {
  getView(): EditorView | null;
  focus(): void;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
  placeholder?: string;
  className?: string;
}

export const CodeMirrorEditor = forwardRef<EditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    { value, onChange, onCursorChange, onSave, placeholder, className },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onCursorRef = useRef(onCursorChange);
    const onSaveRef = useRef(onSave);
    const isExternalUpdate = useRef(false);

    onChangeRef.current = onChange;
    onCursorRef.current = onCursorChange;
    onSaveRef.current = onSave;

    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
      focus: () => viewRef.current?.focus(),
    }));

    // Create editor on mount
    useEffect(() => {
      if (!containerRef.current) return;

      const customKeymap = keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            onSaveRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-b',
          run: (view) => {
            wrapSelection(view, '**', '**');
            return true;
          },
        },
        {
          key: 'Mod-i',
          run: (view) => {
            wrapSelection(view, '*', '*');
            return true;
          },
        },
        {
          key: 'Mod-Shift-s',
          run: (view) => {
            wrapSelection(view, '~~', '~~');
            return true;
          },
        },
        {
          key: 'Mod-e',
          run: (view) => {
            wrapSelection(view, '`', '`');
            return true;
          },
        },
        {
          key: 'Mod-1',
          run: (view) => {
            wrapLine(view, '# ');
            return true;
          },
        },
        {
          key: 'Mod-2',
          run: (view) => {
            wrapLine(view, '## ');
            return true;
          },
        },
        {
          key: 'Mod-3',
          run: (view) => {
            wrapLine(view, '### ');
            return true;
          },
        },
        {
          key: 'Mod-k',
          run: (view) => {
            insertLink(view);
            return true;
          },
        },
        {
          key: 'Mod-Shift-c',
          run: (view) => {
            insertCodeBlock(view);
            return true;
          },
        },
        indentWithTab,
      ]);

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && !isExternalUpdate.current) {
          onChangeRef.current(update.state.doc.toString());
        }
        // Cursor position tracking
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          onCursorRef.current?.(line.number, pos - line.from + 1);
        }
      });

      const theme = EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', Menlo, Consolas, monospace",
          lineHeight: '1.6',
        },
        '.cm-content': {
          padding: '16px 8px',
        },
        '.cm-gutters': {
          backgroundColor: '#fafafa',
          borderRight: '1px solid #e5e7eb',
          color: '#9ca3af',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#f3f4f6',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: '#3b82f6',
        },
        '.cm-selectionBackground': {
          backgroundColor: '#dbeafe !important',
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: '#bfdbfe !important',
        },
        '.cm-panels': {
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        },
        '.cm-panels .cm-button': {
          backgroundImage: 'none',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '2px 8px',
        },
        '.cm-searchMatch': {
          backgroundColor: '#fef08a',
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: '#fbbf24',
        },
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          foldGutter(),
          drawSelection(),
          rectangularSelection(),
          crosshairCursor(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          search({ top: true }),
          autocompletion(),
          customKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          theme,
          updateListener,
          cmPlaceholder(placeholder || '开始写作... (支持 Markdown 语法)'),
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []); // eslint-disable-line

    // Sync external value changes (e.g., document loaded from server)
    const lastValueRef = useRef(value);
    const syncExternalValue = useCallback((newValue: string) => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (newValue !== currentDoc && newValue !== lastValueRef.current) {
        isExternalUpdate.current = true;
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: newValue,
          },
        });
        isExternalUpdate.current = false;
      }
      lastValueRef.current = newValue;
    }, []);

    useEffect(() => {
      syncExternalValue(value);
    }, [value, syncExternalValue]);

    return (
      <div
        ref={containerRef}
        className={`overflow-hidden ${className || ''}`}
      />
    );
  }
);
