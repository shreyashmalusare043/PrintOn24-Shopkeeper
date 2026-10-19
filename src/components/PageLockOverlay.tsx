import React, { useState } from 'react';
import { SixDigitOtpInput } from '@/components/SixDigitOtpInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Lock, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface PageLockOverlayProps {
  isLocked: boolean;
  title: string;
  description?: string;
  unlockButtonText: string;
  onVerifyPassword: (password: string) => Promise<boolean>;
  onUnlockSuccess: () => void;
  children: React.ReactNode;
}

export const PageLockOverlay: React.FC<PageLockOverlayProps> = ({
  isLocked,
  title,
  description,
  unlockButtonText,
  onVerifyPassword,
  onUnlockSuccess,
  children,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  if (!isLocked) {
    return <>{children}</>;
  }

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passcode.length !== 6) {
      setError('Please enter the complete 6-digit numeric password.');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const isValid = await onVerifyPassword(passcode);
      if (isValid) {
        toast.success(`${title} unlocked successfully!`);
        setModalOpen(false);
        setPasscode('');
        onUnlockSuccess();
      } else {
        setError('Incorrect 6-digit security password. Access denied.');
      }
    } catch {
      setError('Password validation failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="relative w-full min-h-[70vh]">
      {/* Blurred Underlying UI */}
      <div className="pointer-events-none filter blur-md select-none opacity-40 transition-all duration-300">
        {children}
      </div>

      {/* Security Lock Centered Overlay */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
        <div className="max-w-md w-full bg-card/95 border border-border p-6 md:p-8 rounded-2xl shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Lock className="w-8 h-8 text-primary" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg md:text-xl font-heading font-bold text-foreground tracking-tight">
              {title} Locked
            </h2>
            <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">
              {description ||
                'This section contains confidential operational metrics and is protected by a separate administrative passcode.'}
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => {
              setError(null);
              setPasscode('');
              setModalOpen(true);
            }}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold h-11 rounded-xl shadow-md gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>{unlockButtonText}</span>
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Configure or update this passcode anytime in <strong>App Settings</strong>.
          </p>
        </div>
      </div>

      {/* Password Entry Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <span>Unlock {title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter your configured 6-digit numeric access password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUnlockSubmit} className="space-y-5 py-3">
            <SixDigitOtpInput
              value={passcode}
              onChange={(val) => {
                setPasscode(val);
                if (error) setError(null);
                if (val.length === 6) {
                  // Auto-submit when 6 digits are reached
                  setTimeout(() => {
                    onVerifyPassword(val).then((valid) => {
                      if (valid) {
                        toast.success(`${title} unlocked successfully!`);
                        setModalOpen(false);
                        setPasscode('');
                        onUnlockSuccess();
                      } else {
                        setError('Incorrect 6-digit security password. Access denied.');
                      }
                    });
                  }, 150);
                }
              }}
              error={error}
              disabled={verifying}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="w-1/2 text-xs h-9 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={passcode.length !== 6 || verifying}
                className="w-1/2 bg-primary text-primary-foreground text-xs h-9 rounded-lg font-semibold"
              >
                {verifying ? 'Verifying...' : 'Unlock Page'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
