import React from 'react';
import QRCodeDataUrl from '@/components/ui/qrcodedataurl';
import { MapPin, Phone, Smartphone, CheckCircle, Shield, Settings, Store } from 'lucide-react';

interface StandeePosterProps {
  shop?: {
    name?: string;
    address?: string;
    contact_phone?: string;
  } | null;
  shopCode: string;
  qrScanUrl: string;
  compact?: boolean;
}

export const StandeePoster: React.FC<StandeePosterProps> = ({
  shop,
  shopCode,
  qrScanUrl,
  compact = false,
}) => {
  const displayAddress = shop?.address || 'Zeal College Of Engineering Narhe Pune';
  const displayPhone = shop?.contact_phone || '8237247109';
  const displayShopCode = shopCode || 'PUNE-AM-010';

  return (
    <div
      className={`relative w-full bg-white text-neutral-900 overflow-hidden font-sans select-none flex flex-col justify-between ${
        compact
          ? 'p-4 sm:p-6 rounded-2xl max-w-md mx-auto shadow-md border border-red-100'
          : 'p-8 sm:p-12 min-h-screen'
      }`}
      style={{
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Dynamic Crimson Curves in Background (Top-Left & Top-Right) */}
      <div className="absolute -top-10 -left-10 w-48 h-48 bg-gradient-to-br from-red-600 via-red-500 to-transparent rounded-full opacity-90 blur-xl pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-56 h-56 bg-gradient-to-bl from-red-700 via-red-600 to-transparent rounded-full opacity-90 blur-xl pointer-events-none" />

      {/* Decorative Red Flowing Corner Arcs */}
      <svg
        className="absolute top-0 left-0 w-36 h-36 pointer-events-none z-0"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0 C 40 0, 70 30, 70 70 C 70 50, 40 20, 0 20 Z"
          fill="#DC2626"
        />
        <path
          d="M0 0 C 60 0, 90 40, 90 90 C 80 60, 50 10, 0 10 Z"
          fill="#B91C1C"
          opacity="0.8"
        />
      </svg>
      <svg
        className="absolute top-0 right-0 w-36 h-36 pointer-events-none z-0 scale-x-[-1]"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0 C 40 0, 70 30, 70 70 C 70 50, 40 20, 0 20 Z"
          fill="#DC2626"
        />
        <path
          d="M0 0 C 60 0, 90 40, 90 90 C 80 60, 50 10, 0 10 Z"
          fill="#B91C1C"
          opacity="0.8"
        />
      </svg>

      {/* White Poster Container Frame */}
      <div className="relative z-10 w-full flex flex-col items-center flex-1 justify-between">
        {/* ================= 1. BRAND HEADER ================= */}
        <div className="w-full flex flex-col items-center pt-2 pb-3">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-neutral-900 font-heading">
              Print<span className="text-red-600">On24</span>
            </span>
          </div>

          <div className="w-full max-w-md flex items-center justify-center gap-2 mt-2">
            <div className="h-[1px] bg-neutral-300 flex-1" />
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-neutral-600 font-sans whitespace-nowrap">
              Smart Counter Printing &amp; Instant Document Hub
            </span>
            <div className="h-[1px] bg-neutral-300 flex-1" />
          </div>
        </div>

        {/* ================= 2. OFFICIAL BADGE & TITLE ================= */}
        <div className="w-full flex flex-col items-center my-2 text-center">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white rounded-full shadow-sm text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">
            <span>OFFICIAL WORKSHOP COUNTER</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-neutral-900 font-heading leading-tight">
            SCAN <span className="text-red-600">QR CODE</span>
          </h1>

          <p className="text-xs sm:text-sm font-bold tracking-widest uppercase text-neutral-700 mt-1">
            FOR FAST &amp; EASY PRINTING
          </p>

          {/* Shop Details: Address & Counter Phone */}
          <div className="flex flex-col items-center justify-center gap-1 mt-2.5 text-xs text-neutral-700 font-medium">
            <div className="flex items-center justify-center gap-1.5 text-center max-w-sm">
              <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="truncate">{displayAddress}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="font-semibold">Counter Support: +91 {displayPhone}</span>
            </div>
          </div>
        </div>

        {/* ================= 3. CENTRAL QR HERO WITH SATELLITE VISUALS ================= */}
        <div className="w-full relative flex items-center justify-center my-3 sm:my-4">
          {/* Left Visual: Document Badges Stack */}
          <div className="hidden sm:flex flex-col items-center gap-2 absolute left-2 lg:left-6 -translate-y-2">
            <div className="relative p-2.5 bg-white/95 backdrop-blur rounded-2xl border border-red-200 shadow-md flex flex-col gap-1.5">
              <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex flex-col items-center justify-center text-[9px] font-black shadow-xs">
                <span>PDF</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                <span>W</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                <span>X</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                <span>P</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
              All Formats
            </span>
          </div>

          {/* Center Target: Scannable QR Code */}
          <div className="relative p-4 sm:p-5 bg-white rounded-3xl border-4 border-red-600 shadow-xl inline-flex flex-col items-center justify-center">
            {/* Red Corner Bracket Accents */}
            <div className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-red-600 rounded-tl-lg" />
            <div className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-red-600 rounded-tr-lg" />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-red-600 rounded-bl-lg" />
            <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-red-600 rounded-br-lg" />

            <div className="p-2 sm:p-3 bg-white rounded-2xl">
              <QRCodeDataUrl
                text={qrScanUrl}
                width={compact ? 180 : 250}
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Right Visual: Laser Printer Graphic & Radio Waves */}
          <div className="hidden sm:flex flex-col items-center gap-2 absolute right-2 lg:right-6 -translate-y-2">
            <div className="p-3 bg-white/95 backdrop-blur rounded-2xl border border-red-200 shadow-md flex flex-col items-center">
              {/* Radio Wave Arcs */}
              <div className="flex items-center justify-center mb-1 text-red-600">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
                </svg>
              </div>

              {/* Modern Laser Printer Illustration */}
              <div className="w-16 h-12 bg-neutral-800 rounded-lg p-1.5 flex flex-col justify-between shadow-inner relative">
                <div className="w-8 h-1 bg-red-500 rounded-full mx-auto" />
                <div className="w-full h-3 bg-neutral-900 rounded flex items-center justify-center">
                  <div className="w-8 h-4 bg-white rounded-t border border-neutral-300 shadow-xs flex flex-col gap-0.5 p-0.5">
                    <div className="w-full h-[1px] bg-neutral-400" />
                    <div className="w-3/4 h-[1px] bg-red-500" />
                  </div>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
              Instant Print
            </span>
          </div>
        </div>

        {/* ================= 4. HIGH CONTRAST SHOP CODE PILL ================= */}
        <div className="w-full flex flex-col items-center my-2">
          <div className="inline-flex items-center justify-center gap-3 px-6 py-2.5 bg-gradient-to-r from-red-600 via-red-600 to-red-700 text-white rounded-full shadow-lg border border-red-500">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div className="h-6 w-[1px] bg-white/40" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[9px] font-bold tracking-widest uppercase text-red-100">
                SHOP CODE:
              </span>
              <span className="text-base sm:text-lg font-black tracking-wider font-mono">
                {displayShopCode}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2.5 text-xs text-neutral-700 font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-red-600" />
            <span>Scan with any Smartphone Camera or QR Scanner</span>
          </div>
        </div>

        {/* ================= 5. FEATURES ROW ================= */}
        <div className="w-full max-w-md flex items-center justify-around py-3 px-4 mt-2 bg-neutral-50/80 rounded-2xl border border-neutral-200/80 text-xs font-bold text-neutral-800">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Fast</span>
          </div>
          <div className="h-3 w-[1px] bg-neutral-300" />
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-red-600" />
            <span>Secure</span>
          </div>
          <div className="h-3 w-[1px] bg-neutral-300" />
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-red-600" />
            <span>Automated Self-Service Printing</span>
          </div>
        </div>

        {/* ================= 6. FORMAL BRANDING ATTRIBUTION FOOTER ================= */}
        <div className="w-full pt-4 mt-4 border-t border-neutral-200 flex flex-col items-center justify-center">
          <div className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-neutral-900 text-white rounded-full text-[11px] font-semibold tracking-wide shadow-sm">
            <Shield className="w-3.5 h-3.5 text-red-500" />
            <span>Powered by High Resolution Software and Coding (HRSAC)</span>
          </div>
        </div>
      </div>

      {/* Decorative Bottom Red Arc Wave */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-16 pointer-events-none z-0"
        viewBox="0 0 400 50"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 25 C 100 50, 300 0, 400 25 L 400 50 L 0 50 Z"
          fill="#DC2626"
          opacity="0.9"
        />
        <path
          d="M0 35 C 120 15, 280 45, 400 30 L 400 50 L 0 50 Z"
          fill="#991B1B"
          opacity="0.8"
        />
      </svg>
    </div>
  );
};

export default StandeePoster;
