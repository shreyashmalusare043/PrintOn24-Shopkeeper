import { useCallback, useRef, useState } from 'react';
import type { PrintProgress } from '@/components/PrintProgressControls';

interface PrintQueueControl {
  progress: PrintProgress | null;
  begin: (orderLabel: string, totalPages: number) => void;
  setTotalPages: (totalPages: number) => void;
  update: (documentName: string, currentPage: number, message?: string) => void;
  completePages: (count: number) => void;
  setMessage: (message: string) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  waitUntilReady: () => Promise<boolean>;
  finish: () => void;
}

export function usePrintQueueControl(): PrintQueueControl {
  const [progress, setProgress] = useState<PrintProgress | null>(null);
  const controlRef = useRef({ paused: false, cancelled: false });

  const begin = useCallback((orderLabel: string, totalPages: number) => {
    controlRef.current = { paused: false, cancelled: false };
    setProgress({
      orderLabel,
      message: 'Finding a compatible printer...',
      documentName: '',
      currentPage: 0,
      totalPages,
      completedPages: 0,
      paused: false,
      cancelling: false,
    });
  }, []);

  const update = useCallback((documentName: string, currentPage: number, message?: string) => {
    setProgress((current) =>
      current
        ? {
            ...current,
            documentName,
            currentPage,
            message: message || 'Sending pages to printer...',
          }
        : current
    );
  }, []);

  const setTotalPages = useCallback((totalPages: number) => {
    setProgress((current) => (current ? { ...current, totalPages } : current));
  }, []);

  const completePages = useCallback((count: number) => {
    setProgress((current) => (current ? { ...current, completedPages: current.completedPages + count } : current));
  }, []);

  const setMessage = useCallback((message: string) => {
    setProgress((current) => (current ? { ...current, message } : current));
  }, []);

  const pause = useCallback(() => {
    controlRef.current.paused = true;
    setProgress((current) => (current ? { ...current, paused: true, message: 'Stopped after the current printer job.' } : current));
  }, []);

  const resume = useCallback(() => {
    controlRef.current.paused = false;
    setProgress((current) => (current ? { ...current, paused: false, message: 'Resuming print queue...' } : current));
  }, []);

  const cancel = useCallback(() => {
    controlRef.current.cancelled = true;
    controlRef.current.paused = false;
    setProgress((current) => (current ? { ...current, paused: false, cancelling: true, message: 'Cancelling remaining pages...' } : current));
  }, []);

  const waitUntilReady = useCallback(async () => {
    while (controlRef.current.paused && !controlRef.current.cancelled) {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    return !controlRef.current.cancelled;
  }, []);

  const finish = useCallback(() => {
    controlRef.current = { paused: false, cancelled: false };
    setProgress(null);
  }, []);

  return {
    progress,
    begin,
    setTotalPages,
    update,
    completePages,
    setMessage,
    pause,
    resume,
    cancel,
    waitUntilReady,
    finish,
  };
}
