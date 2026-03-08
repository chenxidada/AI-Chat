'use client';

import { useState } from 'react';
import { TableCell } from './table-cell';
import { TableContextMenu } from './table-context-menu';
import {
  parseMarkdownTable,
  generateMarkdownTable,
  type TableData,
} from './table-parser';

interface TableEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
}

export function TableEditor({ markdown, onChange, readOnly = false }: TableEditorProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: number;
    col: number;
  } | null>(null);
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);

  const tableData = parseMarkdownTable(markdown);

  if (!tableData) {
    // Fallback: render raw markdown
    return <pre className="text-sm text-gray-500 whitespace-pre-wrap">{markdown}</pre>;
  }

  const { headers, rows, aligns } = tableData;
  const colCount = headers.length;
  const rowCount = rows.length;

  const updateAndEmit = (newData: TableData) => {
    onChange(generateMarkdownTable(newData));
  };

  const updateHeader = (col: number, value: string) => {
    const newHeaders = [...headers];
    newHeaders[col] = value;
    updateAndEmit({ ...tableData, headers: newHeaders });
  };

  const updateCell = (row: number, col: number, value: string) => {
    const newRows = rows.map((r) => [...r]);
    newRows[row][col] = value;
    updateAndEmit({ ...tableData, rows: newRows });
  };

  const handleTab = (row: number, col: number, shift: boolean) => {
    if (shift) {
      // Previous cell
      if (col > 0) {
        setFocusCell({ row, col: col - 1 });
      } else if (row > 0) {
        setFocusCell({ row: row - 1, col: colCount - 1 });
      } else {
        // Go to last header
        setFocusCell({ row: -1, col: colCount - 1 });
      }
    } else {
      // Next cell
      if (col < colCount - 1) {
        setFocusCell({ row, col: col + 1 });
      } else if (row < rowCount - 1) {
        setFocusCell({ row: row + 1, col: 0 });
      } else {
        // Last cell: add new row
        const newRows = [...rows.map((r) => [...r]), Array(colCount).fill('')];
        updateAndEmit({ ...tableData, rows: newRows });
        setFocusCell({ row: rowCount, col: 0 });
      }
    }
  };

  const handleHeaderTab = (col: number, shift: boolean) => {
    if (shift) {
      if (col > 0) setFocusCell({ row: -1, col: col - 1 });
    } else {
      if (col < colCount - 1) {
        setFocusCell({ row: -1, col: col + 1 });
      } else {
        setFocusCell({ row: 0, col: 0 });
      }
    }
  };

  const handleEnter = (row: number, col: number) => {
    if (row < rowCount - 1) {
      setFocusCell({ row: row + 1, col });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    if (readOnly) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, row, col });
  };

  // Context menu actions
  const insertRowAbove = () => {
    if (!contextMenu) return;
    const newRows = [...rows];
    newRows.splice(contextMenu.row, 0, Array(colCount).fill(''));
    updateAndEmit({ ...tableData, rows: newRows });
  };

  const insertRowBelow = () => {
    if (!contextMenu) return;
    const newRows = [...rows];
    newRows.splice(contextMenu.row + 1, 0, Array(colCount).fill(''));
    updateAndEmit({ ...tableData, rows: newRows });
  };

  const insertColLeft = () => {
    if (!contextMenu) return;
    const idx = contextMenu.col;
    const newHeaders = [...headers];
    newHeaders.splice(idx, 0, '');
    const newAligns = [...aligns];
    newAligns.splice(idx, 0, 'none');
    const newRows = rows.map((r) => {
      const nr = [...r];
      nr.splice(idx, 0, '');
      return nr;
    });
    updateAndEmit({ headers: newHeaders, rows: newRows, aligns: newAligns });
  };

  const insertColRight = () => {
    if (!contextMenu) return;
    const idx = contextMenu.col + 1;
    const newHeaders = [...headers];
    newHeaders.splice(idx, 0, '');
    const newAligns = [...aligns];
    newAligns.splice(idx, 0, 'none');
    const newRows = rows.map((r) => {
      const nr = [...r];
      nr.splice(idx, 0, '');
      return nr;
    });
    updateAndEmit({ headers: newHeaders, rows: newRows, aligns: newAligns });
  };

  const deleteRow = () => {
    if (!contextMenu || rowCount <= 1) return;
    const newRows = rows.filter((_, i) => i !== contextMenu.row);
    updateAndEmit({ ...tableData, rows: newRows });
  };

  const deleteCol = () => {
    if (!contextMenu || colCount <= 1) return;
    const idx = contextMenu.col;
    const newHeaders = headers.filter((_, i) => i !== idx);
    const newAligns = aligns.filter((_, i) => i !== idx);
    const newRows = rows.map((r) => r.filter((_, i) => i !== idx));
    updateAndEmit({ headers: newHeaders, rows: newRows, aligns: newAligns });
  };

  const setAlign = (align: 'left' | 'center' | 'right') => {
    if (!contextMenu) return;
    const newAligns = [...aligns];
    newAligns[contextMenu.col] = align;
    updateAndEmit({ ...tableData, aligns: newAligns });
  };

  const getTextAlign = (align: string): 'left' | 'center' | 'right' => {
    if (align === 'center') return 'center';
    if (align === 'right') return 'right';
    return 'left';
  };

  return (
    <div className="my-4 overflow-x-auto">
      <table className="border-collapse border border-gray-300 w-full">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((header, col) => (
              <th
                key={col}
                className="border border-gray-300 px-1 py-0.5 min-w-[80px]"
                style={{ textAlign: getTextAlign(aligns[col]) }}
                onContextMenu={(e) => handleContextMenu(e, -1, col)}
              >
                {readOnly ? (
                  <span className="px-2 py-1 text-sm font-semibold">{header}</span>
                ) : (
                  <TableCell
                    value={header}
                    onChange={(v) => updateHeader(col, v)}
                    isHeader
                    onTab={(shift) => handleHeaderTab(col, shift)}
                    autoFocus={focusCell?.row === -1 && focusCell?.col === col}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50/50">
              {row.map((cell, colIdx) => (
                <td
                  key={colIdx}
                  className="border border-gray-300 px-1 py-0.5"
                  style={{ textAlign: getTextAlign(aligns[colIdx]) }}
                  onContextMenu={(e) => handleContextMenu(e, rowIdx, colIdx)}
                >
                  {readOnly ? (
                    <span className="px-2 py-1 text-sm">{cell}</span>
                  ) : (
                    <TableCell
                      value={cell}
                      onChange={(v) => updateCell(rowIdx, colIdx, v)}
                      onTab={(shift) => handleTab(rowIdx, colIdx, shift)}
                      onEnter={() => handleEnter(rowIdx, colIdx)}
                      autoFocus={focusCell?.row === rowIdx && focusCell?.col === colIdx}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <TableContextMenu
          position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
          onClose={() => setContextMenu(null)}
          onInsertRowAbove={insertRowAbove}
          onInsertRowBelow={insertRowBelow}
          onInsertColLeft={insertColLeft}
          onInsertColRight={insertColRight}
          onDeleteRow={deleteRow}
          onDeleteCol={deleteCol}
          onAlignLeft={() => setAlign('left')}
          onAlignCenter={() => setAlign('center')}
          onAlignRight={() => setAlign('right')}
          canDeleteRow={rowCount > 1}
          canDeleteCol={colCount > 1}
        />
      )}
    </div>
  );
}
