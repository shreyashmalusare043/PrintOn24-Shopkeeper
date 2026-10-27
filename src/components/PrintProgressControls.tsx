export interface PrintProgress {
  orderLabel: string;
  message: string;
  documentName: string;
  currentPage: number;
  totalPages: number;
  completedPages: number;
  paused: boolean;
  cancelling: boolean;
}

interface PrintProgressControlsProps {
  progress: PrintProgress | null;
}

export function PrintProgressControls({ progress }: PrintProgressControlsProps) {
  if (!progress) return null;

  const percentage =
    progress.totalPages > 0 ? Math.round((progress.completedPages / progress.totalPages) * 100) : 0;

  return (
    <div className="fixed right-4 top-20 z-[100] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-foreground">
            Printing {progress.orderLabel}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {progress.message}
          </div>
          {progress.documentName && (
            <div className="mt-1 truncate text-[11px] text-foreground">
              {progress.documentName}
              {progress.currentPage > 0 && ` • Page ${progress.currentPage}`}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{progress.completedPages} / {progress.totalPages} pages submitted</span>
        <span>{percentage}%</span>
      </div>
    </div>
  );
}
