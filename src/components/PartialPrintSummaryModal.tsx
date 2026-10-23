import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Printer, Clock } from 'lucide-react';
import type { PrintedSegment } from '@/types/shopkeeper';

interface PartialPrintSummaryModalProps {
  open: boolean;
  orderNumber?: string;
  tokenNumber?: string;
  printedSegments: PrintedSegment[];
  pendingSegments: Array<{
    docName: string;
    pageRange?: string;
    reason: string;
    pagesCount: number;
  }>;
  onKeepOrder: () => void;
  onMarkCompleted: () => void;
}

export const PartialPrintSummaryModal: React.FC<PartialPrintSummaryModalProps> = ({
  open,
  orderNumber,
  tokenNumber,
  printedSegments,
  pendingSegments,
  onKeepOrder,
  onMarkCompleted,
}) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Print Job Execution Summary #{tokenNumber || orderNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Compatible segments have been processed. Review the printed and pending document portions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Successfully Printed Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">
                Successfully Printed ({printedSegments.length} segment{printedSegments.length !== 1 ? 's' : ''})
              </span>
            </div>
            {printedSegments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic pl-6">No segments printed in this run.</p>
            ) : (
              <div className="space-y-2 pl-2">
                {printedSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-foreground">{seg.doc_name}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>Range: {seg.page_range || 'All Pages'}</span>
                        <span>•</span>
                        <span>{seg.color_mode}</span>
                        <span>•</span>
                        <span>{seg.duplex}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 text-[10px]">
                      {seg.printer_name || 'Physical Printer'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Segments Section */}
          {pendingSegments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">
                  Pending Segments ({pendingSegments.length} unprinted segment{pendingSegments.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="space-y-2 pl-2">
                {pendingSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-foreground">{seg.docName}</div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Reason: {seg.reason}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/40 bg-amber-500/10 text-[10px]">
                      {seg.pageRange ? `Pages ${seg.pageRange}` : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onKeepOrder}
            className="w-full sm:w-auto text-xs"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Keep Order in Active Queue
          </Button>
          <Button
            size="sm"
            onClick={onMarkCompleted}
            disabled={pendingSegments.length > 0}
            className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            {pendingSegments.length > 0 ? 'Print Pending Segments First' : 'Mark Order Completed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};