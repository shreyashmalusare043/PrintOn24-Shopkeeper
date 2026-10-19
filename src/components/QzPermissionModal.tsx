import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Printer, Check } from 'lucide-react';
import { qzTrayService, type QzPermissionRequest, type QzPermissionResult } from '@/services/qzTrayService';

export const QzPermissionModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<QzPermissionRequest | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [resolver, setResolver] = useState<((result: QzPermissionResult) => void) | null>(null);

  useEffect(() => {
    // Register the custom PrintOn24 permission prompt hook with QZ Tray service
    qzTrayService.setPermissionPromptHandler((req) => {
      return new Promise<QzPermissionResult>((resolve) => {
        setRequest(req);
        setRememberChoice(false);
        setResolver(() => resolve);
        setOpen(true);
      });
    });

    return () => {
      qzTrayService.setPermissionPromptHandler(null);
    };
  }, []);

  const handleAllow = () => {
    setOpen(false);
    if (resolver) {
      resolver(rememberChoice ? 'remember_allow' : 'allow');
    }
    setRequest(null);
  };

  const handleDecline = () => {
    setOpen(false);
    if (resolver) {
      resolver('decline');
    }
    setRequest(null);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleDecline()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                PrintOn24 Print Authorization
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Confirm physical document output via PrintOn24
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Target Printer:
            </span>
            <span className="text-xs font-semibold text-foreground">{request.printerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Document:</span>
            <span className="text-xs font-medium text-foreground truncate max-w-[200px]" title={request.fileName}>
              {request.fileName}
            </span>
          </div>
          {request.copies && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Copies:</span>
              <span className="text-xs font-medium text-foreground">{request.copies}</span>
            </div>
          )}
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg bg-muted/30 border border-border/60">
            <input
              type="checkbox"
              className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">Remember My Decision</span>
              <span className="text-[11px] text-muted-foreground">Keep QZ Tray running in background without repeating prompts</span>
            </div>
          </label>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline
          </Button>
          <Button size="sm" onClick={handleAllow} className="gap-1.5">
            <Check className="w-4 h-4" /> Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};