'use client';

import { useState } from 'react';
import { Pin, Star, Archive, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BatchActionsProps {
  selectedIds: string[];
  onClear: () => void;
  onBatchOperation: (operation: string) => void;
}

export function BatchActions({ selectedIds, onClear, onBatchOperation }: BatchActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-lg shadow-lg p-3 flex items-center gap-3 z-50">
        <span className="text-sm">
          已选择 {selectedIds.length} 个对话
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-800"
            onClick={() => onBatchOperation('pin')}
          >
            <Pin className="h-4 w-4 mr-1" />
            置顶
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-800"
            onClick={() => onBatchOperation('star')}
          >
            <Star className="h-4 w-4 mr-1" />
            星标
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-800"
            onClick={() => onBatchOperation('archive')}
          >
            <Archive className="h-4 w-4 mr-1" />
            归档
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-gray-800 hover:text-red-400"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            删除
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800"
          onClick={onClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.length} 个对话吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                onBatchOperation('delete');
                setShowDeleteDialog(false);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
