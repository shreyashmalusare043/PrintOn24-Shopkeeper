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
import { RotateCw, CheckCircle2 } from 'lucide-react';

interface ManualDuplexModalProps {
  open: boolean;
  printerName: string;
  docName: string;
  onConfirmReinserted: () => void;
  onCancel: () => void;
}

export const ManualDuplexModal: React.FC<ManualDuplexModalProps> = ({
  open,
  printerName,
  docName,
  onConfirmReinserted,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Manual Duplex Paper Reinsertion
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Printer "{printerName}" requires manual paper turning
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-2 border border-border">
          <p className="text-foreground">
            The front side for <span className="font-semibold">{docName}</span> has finished printing.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 text-[11px] text-amber-700 dark:text-amber-400">
            <strong>Action required:</strong> Please take the printed sheets from the output tray, re-insert them into the input paper tray in reverse orientation without changing page order, and then click below to print the reverse sides.
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel Print
          </Button>
          <Button size="sm" onClick={onConfirmReinserted} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Continue Printing Back Side
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};