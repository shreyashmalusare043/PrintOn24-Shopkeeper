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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sliders,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import type { ShopPrinter } from '@/types/shopkeeper';

export interface PrinterDriverSettings {
  printerId: string;
  printerName: string;
  paperSize: string;
  outputSize: string;
  orientation?: 'Portrait' | 'Landscape' | null;
  mediaSource: string;
  mediaType: string;
  colorMode?: 'B&W' | 'Color' | null;
  duplex: 'Single Side' | 'Back-to-Back' | 'Tumble';
  scaling: 'fit' | 'actual' | 'shrink';
  copies: number;
  dpi: number;
  equalMargins: boolean;
}

interface PrinterPropertiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printers: ShopPrinter[];
  selectedPrinter?: ShopPrinter | null;
  currentSettings: Partial<PrinterDriverSettings>;
  documentScopeLabel?: string;
  onApplySettings: (settings: PrinterDriverSettings) => void;
}

export const PrinterPropertiesDialog: React.FC<PrinterPropertiesDialogProps> = ({
  open,
  onOpenChange,
  printers,
  selectedPrinter,
  currentSettings,
  documentScopeLabel,
  onApplySettings,
}) => {
  const [activeTab, setActiveTab] = useState<'paper' | 'layout'>('paper');

  // Selected printer
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(
    selectedPrinter?.id || printers[0]?.id || ''
  );

  // Current printer object
  const currentPrinterObj =
    printers.find((p) => p.id === selectedPrinterId) || selectedPrinter || printers[0];

  // Driver properties state
  const [paperSize, setPaperSize] = useState<string>(currentSettings.paperSize || 'A4');
  const [outputSize, setOutputSize] = useState<string>(currentSettings.outputSize || 'Same as Document');
  const [orientation, setOrientation] = useState<'Portrait' | 'Landscape' | null>(
    currentSettings.orientation !== undefined ? currentSettings.orientation : null
  );
  const [mediaSource, setMediaSource] = useState<string>(currentSettings.mediaSource || 'Auto Select');
  const [mediaType, setMediaType] = useState<string>(currentSettings.mediaType || 'Standard 75 GSM');
  const [colorMode, setColorMode] = useState<'B&W' | 'Color' | null>(
    currentSettings.colorMode !== undefined ? currentSettings.colorMode : null
  );
  const [duplex, setDuplex] = useState<'Single Side' | 'Back-to-Back' | 'Tumble'>(
    currentSettings.duplex || (currentPrinterObj?.is_duplex ? 'Back-to-Back' : 'Single Side')
  );
  const [scaling, setScaling] = useState<'fit' | 'actual' | 'shrink'>(
    currentSettings.scaling || 'fit'
  );
  const [copies, setCopies] = useState<number>(currentSettings.copies || 1);
  const [dpi, setDpi] = useState<number>(currentSettings.dpi || 600);
  const [equalMargins, setEqualMargins] = useState<boolean>(
    currentSettings.equalMargins !== undefined ? currentSettings.equalMargins : true
  );

  // Sync when dialog opens or printer changes
  useEffect(() => {
    if (open) {
      if (selectedPrinter) {
        setSelectedPrinterId(selectedPrinter.id);
      } else if (printers.length > 0 && !selectedPrinterId) {
        setSelectedPrinterId(printers[0].id);
      }
      if (currentSettings.paperSize) setPaperSize(currentSettings.paperSize);
      if (currentSettings.outputSize) setOutputSize(currentSettings.outputSize);
      setOrientation(currentSettings.orientation !== undefined ? currentSettings.orientation : null);
      setColorMode(currentSettings.colorMode !== undefined ? currentSettings.colorMode : null);
      if (currentSettings.duplex) setDuplex(currentSettings.duplex);
      if (currentSettings.scaling) setScaling(currentSettings.scaling);
      if (currentSettings.copies) setCopies(currentSettings.copies);
      if (currentSettings.mediaSource) setMediaSource(currentSettings.mediaSource);
      if (currentSettings.mediaType) setMediaType(currentSettings.mediaType);
    }
  }, [open, selectedPrinter, printers, currentSettings]);

  // Available paper sizes based on printer capabilities
  const supportedPaperSizes =
    currentPrinterObj?.paper_sizes && currentPrinterObj.paper_sizes.length > 0
      ? currentPrinterObj.paper_sizes
      : ['A4', 'A3', 'Legal', 'Letter', 'A5'];

  const isSelectedPaperSupported =
    !currentPrinterObj ||
    !currentPrinterObj.paper_sizes ||
    currentPrinterObj.paper_sizes.length === 0 ||
    currentPrinterObj.paper_sizes.some((s) => s.toLowerCase() === paperSize.toLowerCase());

  const toggleColorMode = (mode: 'B&W' | 'Color') => {
    setColorMode((prev) => (prev === mode ? null : mode));
  };

  const toggleOrientation = (orient: 'Portrait' | 'Landscape') => {
    setOrientation((prev) => (prev === orient ? null : orient));
  };

  const handleOutputSizeChange = (val: string) => {
    setOutputSize(val);
    if (val === 'Fit to A4' || val === 'A4') {
      setPaperSize('A4');
      setScaling('fit');
    } else if (val === 'Fit to A3' || val === 'A3') {
      setPaperSize('A3');
      setScaling('fit');
    } else if (val === 'Fit to Legal' || val === 'Legal') {
      setPaperSize('Legal');
      setScaling('fit');
    } else if (val === 'Fit to Letter' || val === 'Letter') {
      setPaperSize('Letter');
      setScaling('fit');
    }
  };

  const handleApply = () => {
    onApplySettings({
      printerId: currentPrinterObj?.id || selectedPrinterId,
      printerName: currentPrinterObj?.name || 'Default Printer',
      paperSize,
      outputSize,
      orientation,
      mediaSource,
      mediaType,
      colorMode,
      duplex,
      scaling,
      copies: Math.max(1, copies),
      dpi,
      equalMargins,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl bg-[#1e1f23] text-white border-neutral-700 shadow-2xl p-0 overflow-hidden">
        {/* Header styling matching native OS Driver Properties window */}
        <div className="bg-[#18191c] px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-heading font-bold text-white flex items-center gap-2">
                <span>Printer Properties</span>

              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                Configure actual hardware driver settings & media routing for physical print job
              </DialogDescription>
              {documentScopeLabel && (
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <span className="text-neutral-400 font-mono">Scope:</span>
                  <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary font-mono text-[11px] py-0">
                    {documentScopeLabel}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Driver Ready</span>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Target Printer Selector */}
          <div className="p-3.5 bg-neutral-900/90 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-neutral-300 uppercase font-mono flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-primary" /> Target Physical Printer
              </Label>
              {currentPrinterObj && (
                <div className="flex items-center gap-2">
                  {currentPrinterObj.is_color ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                      Color Supported
                    </Badge>
                  ) : (
                    <Badge className="bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px]">
                      Monochrome Only
                    </Badge>
                  )}
                  {currentPrinterObj.is_duplex ? (
                    <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px]">
                      Auto Duplex
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                      Single Side
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <select
              value={selectedPrinterId}
              onChange={(e) => setSelectedPrinterId(e.target.value)}
              className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.driver_name ? `(${p.driver_name})` : ''} - {p.connection_type || 'USB/LAN'}
                </option>
              ))}
            </select>
            {currentPrinterObj && (
              <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-3 pt-1">
                <span>Driver: <strong className="text-neutral-200">{currentPrinterObj.driver_name || 'Generic PostScript'}</strong></span>
                <span>•</span>
                <span>Supported: <strong className="text-neutral-200">{supportedPaperSizes.join(', ')}</strong></span>
              </div>
            )}
          </div>

          {/* Paper Size Hardware Compatibility Alert */}
          {!isSelectedPaperSupported && currentPrinterObj && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl flex items-start gap-2.5 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-300">
                  Paper Size Unsupported by {currentPrinterObj.name}
                </p>
                <p className="text-[11px] text-red-200/90 leading-relaxed font-mono">
                  Requested <strong>{paperSize}</strong> is not listed in this printer&apos;s supported sizes ({supportedPaperSizes.join(', ')}). The system will report an error and hold the job pending instead of silently substituting A4.
                </p>
              </div>
            </div>
          )}

          {/* Configuration Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-[#121316] border border-neutral-800 rounded-lg p-1">
              <TabsTrigger
                value="paper"
                className="text-xs font-heading font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Paper & Media Quality
              </TabsTrigger>
              <TabsTrigger
                value="layout"
                className="text-xs font-heading font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" /> Layout & Finishing
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Paper & Media Quality */}
            <TabsContent value="paper" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Paper Size */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Paper Size <span className="text-red-400">*</span>
                  </Label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="A4">A4 (210 x 297 mm / 8.27 x 11.69 in)</option>
                    <option value="A3">A3 (297 x 420 mm / 11.69 x 16.54 in)</option>
                    <option value="Legal">Legal (216 x 356 mm / 8.5 x 14.0 in)</option>
                    <option value="Letter">Letter (216 x 279 mm / 8.5 x 11.0 in)</option>
                    <option value="Tabloid">Tabloid / 11x17 (279 x 432 mm / 11.0 x 17.0 in)</option>
                    <option value="A5">A5 (148 x 210 mm / 5.83 x 8.27 in)</option>
                    <option value="Executive">Executive (184 x 267 mm / 7.25 x 10.5 in)</option>
                    <option value="Glossy">Glossy Photo Paper (A4 / 210 x 297 mm)</option>
                    <option value="Photo 4x6">Photo 4x6 in (102 x 152 mm)</option>
                  </select>
                  {!supportedPaperSizes.some((s) => s.toLowerCase() === paperSize.toLowerCase()) && (
                    <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1 font-mono">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      Notice: Selected size may require Bypass Tray or manual feed
                    </p>
                  )}
                </div>

                {/* Output Paper Size */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Output Paper Size
                  </Label>
                  <select
                    value={outputSize}
                    onChange={(e) => handleOutputSizeChange(e.target.value)}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="Same as Document">Same as Document Size ({paperSize})</option>
                    <option value="A4">Fit to A4</option>
                    <option value="A3">Fit to A3</option>
                    <option value="Legal">Fit to Legal</option>
                    <option value="Letter">Fit to Letter</option>
                  </select>
                </div>

                {/* Paper Source / Tray */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Paper Source (Tray Routing)
                  </Label>
                  <select
                    value={mediaSource}
                    onChange={(e) => setMediaSource(e.target.value)}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="Auto Select">Auto Select (Driver Managed)</option>
                    <option value="Tray 1">Tray 1 (Cassette - Standard A4/Letter)</option>
                    <option value="Tray 2">Tray 2 (High Capacity / A3 Tray)</option>
                    <option value="Bypass Tray">Bypass Tray (Multi-Purpose / Glossy)</option>
                    <option value="Manual Feed">Manual Feed Slot</option>
                  </select>
                </div>

                {/* Media Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Media / Paper Type
                  </Label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value)}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="Standard 75 GSM">Plain Paper (75-80 GSM)</option>
                    <option value="Bond Paper">Bond Paper (85-90 GSM)</option>
                    <option value="Glossy">Glossy Photo Paper (180-250 GSM)</option>
                    <option value="Executive">Executive Heavy Paper (100 GSM)</option>
                    <option value="Cardstock">Heavy / Cardstock (300 GSM)</option>
                    <option value="Recycled">Recycled Paper</option>
                  </select>
                </div>

                {/* Color Mode (Toggleable, neither selected by default) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-neutral-300">
                      Color Mode
                    </Label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {colorMode ? `Override: ${colorMode}` : 'Default: Document Original'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColorMode('B&W')}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                        colorMode === 'B&W'
                          ? 'bg-neutral-800 border-primary text-white font-bold ring-1 ring-primary shadow-sm'
                          : 'bg-[#121316] border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                      }`}
                    >
                      Black & White (Grayscale)
                    </button>
                    <button
                      type="button"
                      disabled={!currentPrinterObj?.is_color}
                      onClick={() => toggleColorMode('Color')}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                        colorMode === 'Color'
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold ring-1 ring-emerald-500 shadow-sm'
                          : 'bg-[#121316] border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 disabled:opacity-40 disabled:hover:text-neutral-400'
                      }`}
                      title={!currentPrinterObj?.is_color ? 'Printer does not support color' : ''}
                    >
                      Full Color
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-mono">
                    * Neither selected preserves document original color configuration. Click active option to deselect.
                  </p>
                </div>

                {/* Print Resolution / DPI */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Print Resolution (DPI)
                  </Label>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value))}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value={300}>300 DPI (Draft / Fast)</option>
                    <option value={600}>600 DPI (Standard High Quality)</option>
                    <option value={1200}>1200 DPI (Fine Photo Quality)</option>
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Layout & Finishing */}
            <TabsContent value="layout" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Orientation (Toggleable, neither selected by default) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-neutral-300">
                      Orientation
                    </Label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {orientation ? `Override: ${orientation}` : 'Default: Preserve Source'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleOrientation('Portrait')}
                      className={`py-2.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                        orientation === 'Portrait'
                          ? 'bg-neutral-800 border-primary text-white font-bold ring-1 ring-primary shadow-sm'
                          : 'bg-[#121316] border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                      }`}
                    >
                      <div className="w-3 h-4 border border-current rounded-sm" />
                      <span>Portrait</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleOrientation('Landscape')}
                      className={`py-2.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                        orientation === 'Landscape'
                          ? 'bg-neutral-800 border-primary text-white font-bold ring-1 ring-primary shadow-sm'
                          : 'bg-[#121316] border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                      }`}
                    >
                      <div className="w-4 h-3 border border-current rounded-sm" />
                      <span>Landscape</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-mono">
                    * Neither selected preserves source document orientation. Click active option to deselect.
                  </p>
                </div>

                {/* Duplex / 2-Sided Printing */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    2-Sided (Duplex) Printing
                  </Label>
                  <select
                    value={duplex}
                    onChange={(e) => setDuplex(e.target.value as any)}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="Single Side">1-Sided (Single Side)</option>
                    <option value="Back-to-Back">2-Sided (Flip on Long Edge / Book)</option>
                    <option value="Tumble">2-Sided (Flip on Short Edge / Calendar)</option>
                  </select>
                  {!currentPrinterObj?.is_duplex && duplex !== 'Single Side' && (
                    <p className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      Requires manual paper reinsertion prompt during print
                    </p>
                  )}
                </div>

                {/* Scaling / Fit to Paper */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Page Scaling & Margin Alignment
                  </Label>
                  <select
                    value={scaling}
                    onChange={(e) => setScaling(e.target.value as any)}
                    className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="fit">Fit to Paper (Equal Balanced Margins)</option>
                    <option value="actual">100% / Actual Size (No Scaling)</option>
                    <option value="shrink">Shrink Oversize Paper Only</option>
                  </select>
                </div>

                {/* Copies */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-300">
                    Number of Copies
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-[#121316] border-neutral-700 text-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Fit & Margin Guarantee Info Banner */}
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-start gap-2.5 text-xs text-neutral-300">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <span className="font-semibold text-white">Equal Margins & Zero Clipping Guarantee:</span>
                  <p className="text-[11px] text-neutral-400">
                    Documents are automatically centered with balanced margins on all four sides. Portrait and Landscape orientations are strictly maintained from preview through physical output without distortion.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="bg-[#18191c] px-6 py-3 border-t border-neutral-800 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400 font-mono hidden sm:block">
            Target: <strong className="text-primary">{paperSize}</strong> • {orientation || 'Original Orientation'} • {colorMode || 'Original Color'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Apply & Save Driver Properties
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
