import { Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export function PrintProgressControls({
  progress,
  onPause,
  onResume,
  onCancel,
}: PrintProgressControlsProps) {
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
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          Stops new submissions. Jobs already in the Windows printer queue may still print.
        </p>
        <div className="flex shrink-0 gap-1">
          {progress.cancelling ? (
            <Button type="button" size="sm" variant="outline" disabled className="h-7 px-2 text-[10px]">
              Stopping...
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={progress.paused ? onResume : onPause}
                className="h-7 px-2 text-[10px]"
              >
                {progress.paused ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />}
                {progress.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onCancel}
                className="h-7 px-2 text-[10px]"
              >
                <X className="mr-1 h-3 w-3" />
                Stop Remaining
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
