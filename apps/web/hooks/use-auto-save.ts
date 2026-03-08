import { useRef, useEffect, useCallback, useState } from 'react';

export interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  error: string | null;
}

interface UseAutoSaveOptions {
  delay?: number;
  onSave: () => Promise<void>;
}

export function useAutoSave({ delay = 2000, onSave }: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>({
    status: 'idle',
    lastSavedAt: null,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const doSave = useCallback(async () => {
    setSaveStatus((s) => ({ ...s, status: 'saving', error: null }));
    try {
      await onSaveRef.current();
      setSaveStatus({ status: 'saved', lastSavedAt: new Date(), error: null });
    } catch {
      setSaveStatus((s) => ({ ...s, status: 'error', error: '保存失败' }));
    }
  }, []);

  const scheduleAutoSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveStatus((s) => (s.status === 'saved' || s.status === 'idle' ? { ...s, status: 'idle' } : s));
    timerRef.current = setTimeout(() => doSave(), delay);
  }, [doSave, delay]);

  const manualSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave();
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveStatus, scheduleAutoSave, manualSave };
}

export function formatSaveStatus(status: AutoSaveStatus): string {
  switch (status.status) {
    case 'idle':
      return '未保存更改';
    case 'saving':
      return '保存中...';
    case 'saved': {
      if (!status.lastSavedAt) return '已保存';
      const time = status.lastSavedAt.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `已保存 (${time})`;
    }
    case 'error':
      return status.error || '保存失败';
  }
}
