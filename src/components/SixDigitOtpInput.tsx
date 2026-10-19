import React, { useRef, useEffect } from 'react';

interface SixDigitOtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export const SixDigitOtpInput: React.FC<SixDigitOtpInputProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    // Focus first input on mount
    if (!disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Extract only digits
    const cleanDigit = rawVal.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = cleanDigit;
    const combined = newDigits.join('');
    onChange(combined);

    // Auto-advance to next input if digit entered
    if (cleanDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous and clear it
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      onChange(pastedData);
      const nextIdx = Math.min(pastedData.length, 5);
      inputRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            disabled={disabled}
            value={digits[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border bg-background text-foreground transition-all focus:outline-none focus:ring-2 ${
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
                : 'border-border focus:border-primary focus:ring-primary/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        ))}
      </div>
      {error && (
        <p className="text-xs text-destructive text-center font-medium animate-in fade-in">
          {error}
        </p>
      )}
    </div>
  );
};
