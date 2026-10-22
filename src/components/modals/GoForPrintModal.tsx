import React, { useState, useEffect, useMemo } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { ShopPrinter, ShopPricing, DynamicPaperType } from '@/types/shopkeeper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Printer,
  Monitor,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Zap,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Usb,
  Wifi,
  ExternalLink,
} from 'lucide-react';

export const GoForPrintModal: React.FC = () => {
  const {
    user,
    pcs,
    realPrinters,
    refreshPrinters,
    agentStatus,
    isGoForPrintOpen,
    setIsGoForPrintOpen,
    targetPrintOrder,
  } = useShopkeeper();

  // Workflow Steps: 'configure' | 'preview' | 'printing' | 'completed'
  const [currentStep, setCurrentStep] = useState<'configure' | 'preview' | 'printing' | 'completed'>('configure');

  // Selected Hardware State
  const [selectedPcId, setSelectedPcId] = useState<string>('');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');

  // Document & Print Parameters
  const [fileName, setFileName] = useState<string>('Document_Print.pdf');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(1);
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<'B&W' | 'Color'>('B&W');
  const [duplex, setDuplex] = useState<'Single Side' | 'Back-to-Back'>('Single Side');
  const [paperSize, setPaperSize] = useState<string>('A4');
  const [paperType, setPaperType] = useState<'Standard 75 GSM' | 'Bond Paper' | 'Glossy' | 'Executive'>('Standard 75 GSM');
  const [pageRange, setPageRange] = useState<string>('All');

  // Pricing State
  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [dynamicPaperTypes, setDynamicPaperTypes] = useState<DynamicPaperType[]>([]);

  // Spooling Progress
  const [printProgress, setPrintProgress] = useState<number>(0);
  const [printStatusMsg, setPrintStatusMsg] = useState<string>('Initializing hardware spooler...');
  const [completedJobId, setCompletedJobId] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Initialize form when modal opens or target order changes
  useEffect(() => {
    if (isGoForPrintOpen) {
      setCurrentStep('configure');
      setPrintProgress(0);

      // Auto-select active PC (first online or current)
      const activePc = pcs.find((p) => p.is_current_pc) || pcs.find((p) => p.status === 'online') || pcs[0];
      if (activePc) {
        setSelectedPcId(activePc.id);
      }

      // Fetch pricing & dynamic paper types
      if (user?.shop_id) {
        shopkeeperApi.getShopPricing(user.shop_id).then(setPricing);
        shopkeeperApi.getDynamicPaperTypes(user.shop_id).then(setDynamicPaperTypes);
      }

      // If opening with an existing order from live queue:
      if (targetPrintOrder) {
        setFileName(targetPrintOrder.document_name || 'Customer_Document.pdf');
        setFileUrl(targetPrintOrder.file_url || '');
        setPageCount(targetPrintOrder.total_pages || 1);
        setCopies(targetPrintOrder.config_copies || 1);
        setColorMode(targetPrintOrder.config_print_type === 'Color' ? 'Color' : 'B&W');
        setDuplex(targetPrintOrder.config_sides === 'Back to Back' || targetPrintOrder.config_sides === 'Double Side' ? 'Back-to-Back' : 'Single Side');
        setPaperSize((targetPrintOrder.config_page_size as any) || 'A4');
        setPaperType((targetPrintOrder.config_paper_type as any) || 'Standard 75 GSM');
      } else {
        // Default clean job
        setFileName('Scan_or_Upload_Document.pdf');
        setFileUrl('');
        setPageCount(4);
        setCopies(1);
        setColorMode('B&W');
        setDuplex('Single Side');
        setPaperSize('A4');
        setPaperType('Standard 75 GSM');
      }
    }
  }, [isGoForPrintOpen, targetPrintOrder, pcs, user?.shop_id]);

  // Filter printers available for selected PC
  const availablePrinters = useMemo(() => {
    if (!realPrinters || realPrinters.length === 0) return [];
    return realPrinters;
  }, [realPrinters]);

  // Auto-select printer if none selected
  useEffect(() => {
    if (availablePrinters.length > 0 && !selectedPrinterId) {
      const defaultPrinter = availablePrinters.find((p) => p.is_default) || availablePrinters[0];
      setSelectedPrinterId(defaultPrinter.id);
    }
  }, [availablePrinters, selectedPrinterId]);

  const activePrinter = useMemo(() => {
    return availablePrinters.find((p) => p.id === selectedPrinterId) || availablePrinters[0] || null;
  }, [availablePrinters, selectedPrinterId]);

  const activePc = useMemo(() => {
    return pcs.find((p) => p.id === selectedPcId) || pcs[0] || null;
  }, [pcs, selectedPcId]);

  // Dynamic Price Calculation
  const totalPrice = useMemo(() => {
    // Check if matched in dynamic paper types
    const matchedDynamic = dynamicPaperTypes.find(
      (pt) =>
        pt.is_active !== false &&
        (pt.name.toLowerCase() === paperType.toLowerCase() ||
          pt.id.toLowerCase() === paperType.toLowerCase() ||
          pt.name.toLowerCase() === paperSize.toLowerCase())
    );
    if (matchedDynamic) {
      const dynamicRate = colorMode === 'Color' ? Number(matchedDynamic.color_price) : Number(matchedDynamic.bw_price);
      if (dynamicRate > 0) {
        return dynamicRate * pageCount * copies;
      }
    }

    if (!pricing) {
      const base = colorMode === 'Color' ? 10 : 2;
      return base * pageCount * copies;
    }

    let rate = 0;
    if (colorMode === 'Color') {
      rate = duplex === 'Back-to-Back' ? (pricing.color_back_to_back || 8) : (pricing.color_single || 5);
    } else {
      rate = duplex === 'Back-to-Back' ? (pricing.bw_back_to_back || 1.5) : (pricing.bw_single || 1);
    }

    if (paperSize === 'A3') rate += Math.max(0, (Number(pricing.a3_rate) || 4) - (Number(pricing.a4_rate) || 1));
    if (paperType === 'Bond Paper') rate += (pricing.bond_paper_rate ?? pricing.bond_rate ?? 2);
    if (paperType === 'Glossy') rate += (pricing.glossy_paper_rate ?? pricing.glossy_rate ?? 5);

    return rate * pageCount * copies;
  }, [pricing, dynamicPaperTypes, colorMode, duplex, paperSize, paperType, pageCount, copies]);

  // Handle local file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setFileUrl(URL.createObjectURL(file));
      // Estimate page count based on file size or default
      const estimatedPages = file.type.includes('image') ? 1 : Math.max(1, Math.round(file.size / 60000));
      setPageCount(estimatedPages);
      toast.success(`Loaded document "${file.name}" (${estimatedPages} page(s) detected)`);
    }
  };

  // Execute Physical Print Job
  const handleExecutePrint = async () => {
    if (!activePrinter) {
      toast.error('Please select an active physical printer before proceeding.');
      return;
    }

    if (!activePrinter.is_online && activePrinter.status === 'offline') {
      toast.error(`Printer "${activePrinter.name}" is currently offline. Please turn it on or check USB/Network.`);
      return;
    }

    setIsDispatching(true);
    setCurrentStep('printing');
    setPrintProgress(20);
    setPrintStatusMsg(`Sending direct silent print via QZ Tray for [${activePrinter.name}]...`);

    try {
      // Real dispatch to Supabase and Local printOn24 Agent on shopkeeper PC
      const res = await shopkeeperApi.executeGoForPrint({
        orderId: targetPrintOrder?.id,
        shopId: user?.shop_id || 'ent-02',
        pcId: activePc?.id || 'pc_01',
        printerId: activePrinter.id,
        printerName: activePrinter.name,
        fileName: fileName,
        fileUrl: fileUrl,
        copies: copies,
        colorMode: colorMode,
        duplex: duplex,
        paperSize: paperSize,
        paperType: paperType,
        pageCount: pageCount,
        pageRange: pageRange,
        totalPrice: totalPrice,
        orientation: (paperSize === 'A3' || (fileName && /\.(pptx?)$/i.test(fileName))) ? 'Landscape' : 'Portrait',
        scaling: 'fit',
        driverProperties: {
          density: 300,
          dpi: 300,
          colorType: colorMode === 'Color' ? 'color' : 'grayscale',
          duplex: duplex === 'Back-to-Back' || (duplex as any) === 'duplex',
        },
      });

      if (!res.success) {
        throw new Error(res.message || 'Print execution failed on printOn24 Agent');
      }

      setPrintProgress(100);
      setPrintStatusMsg(`Print job sent to physical Windows printer [${activePrinter.name}].`);
      setCompletedJobId(res.jobId);
      setCurrentStep('completed');
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message || 'Print dispatch failed.');
      setCurrentStep('configure');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <Dialog open={isGoForPrintOpen} onOpenChange={setIsGoForPrintOpen}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl bg-card border-border rounded-xl shadow-2xl p-0 overflow-hidden font-sans">
        {/* Header Bar */}
        <div className="bg-primary px-6 py-4 text-primary-foreground flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center text-primary-foreground">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-heading font-bold tracking-tight uppercase flex items-center gap-2">
                <span>Go For Print</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground font-mono font-medium">
                  QZ Tray Silent Engine
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-primary-foreground/80 font-sans">
                Direct physical printing via QZ Tray without browser print preview or dialogs.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 ${
                agentStatus.connected
                  ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-100 border border-amber-400/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${agentStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {agentStatus.connected ? 'QZ Tray Active' : 'QZ Tray Offline'}
            </span>
          </div>
        </div>

        {/* STEP 1: CONFIGURE & VERIFY WORKFLOW */}
        {currentStep === 'configure' && (
          <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
            {/* Target Hardware Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border border-border">
              {/* Select PC */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground uppercase flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-primary" />
                    Target Counter PC
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {activePc?.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <select
                  value={selectedPcId}
                  onChange={(e) => setSelectedPcId(e.target.value)}
                  className="w-full bg-card border border-border text-xs px-3 py-2 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {pcs.map((pc) => (
                    <option key={pc.id} value={pc.id}>
                      {pc.pc_name} {pc.is_current_pc ? '(This PC)' : ''} — {pc.ip_address}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground font-mono">
                  OS: {activePc?.os_info || 'Windows 11'}
                </p>
              </div>

              {/* Select Real Printer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground uppercase flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-primary" />
                    Detected Real Printer
                  </Label>
                  <button
                    type="button"
                    onClick={refreshPrinters}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 font-mono"
                  >
                    <RotateCw className="w-3 h-3" /> Rescan
                  </button>
                </div>
                <select
                  value={selectedPrinterId}
                  onChange={(e) => setSelectedPrinterId(e.target.value)}
                  className="w-full bg-card border border-border text-xs px-3 py-2 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availablePrinters.map((prn) => (
                    <option key={prn.id} value={prn.id}>
                      {prn.name} [{prn.connection_type.toUpperCase()}] ({prn.is_color ? 'Color' : 'B&W'})
                    </option>
                  ))}
                </select>
                {activePrinter && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Hardware Ready
                    </span>
                    <span>•</span>
                    <span>
                      {activePrinter.connection_type?.toLowerCase().includes('wifi') ||
                      activePrinter.connection_type?.toLowerCase().includes('wi-fi')
                        ? 'Wi-Fi Wireless'
                        : activePrinter.connection_type?.toLowerCase().includes('lan') ||
                          activePrinter.connection_type?.toLowerCase().includes('network')
                        ? 'LAN Ethernet'
                        : 'USB Cable'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Document Selection / Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground uppercase flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Select / Upload Document
              </Label>
              <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{fileName}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {pageCount} page(s) • Ready for spooling
                  </p>
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.txt,image/*"
                    onChange={handleFileUpload}
                  />
                  <div className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 border border-border">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span>Upload File</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Print Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Color Mode */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Color Mode</Label>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setColorMode('B&W')}
                    className={`py-1 text-xs font-medium rounded-md transition-all ${
                      colorMode === 'B&W' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    B&W
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorMode('Color')}
                    className={`py-1 text-xs font-medium rounded-md transition-all ${
                      colorMode === 'Color' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Color
                  </button>
                </div>
              </div>

              {/* Sides / Duplex */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Sides</Label>
                <select
                  value={duplex}
                  onChange={(e) => setDuplex(e.target.value as any)}
                  className="w-full bg-card border border-border text-xs px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Single Side">Single Side</option>
                  <option value="Back-to-Back">Back-to-Back</option>
                </select>
              </div>

              {/* Paper Size */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Paper Size</Label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as any)}
                  className="w-full bg-card border border-border text-xs px-2.5 py-1.5 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {dynamicPaperTypes && dynamicPaperTypes.length > 0 ? (
                    dynamicPaperTypes
                      .filter((pt) => pt.is_active !== false)
                      .map((pt) => (
                        <option key={pt.id} value={pt.name}>
                          {pt.name} (₹{colorMode === 'Color' ? pt.color_price : pt.bw_price}/pg)
                        </option>
                      ))
                  ) : (
                    <>
                      <option value="A4">A4 Standard</option>
                      <option value="A3">A3 Ledger</option>
                      <option value="Legal">Legal</option>
                      <option value="Letter">Letter</option>
                    </>
                  )}
                </select>
              </div>

              {/* Copies */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Copies</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-xs bg-card border-border rounded-lg"
                />
              </div>
            </div>

            {/* Paper Type & Page Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Paper Media Type</Label>
                <select
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value as any)}
                  className="w-full bg-card border border-border text-xs px-3 py-2 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {dynamicPaperTypes && dynamicPaperTypes.length > 0 ? (
                    dynamicPaperTypes
                      .filter((pt) => pt.is_active !== false)
                      .map((pt) => (
                        <option key={pt.id} value={pt.name}>
                          {pt.name} (₹{colorMode === 'Color' ? pt.color_price : pt.bw_price}/page)
                        </option>
                      ))
                  ) : (
                    <>
                      <option value="Standard 75 GSM">Standard 75 GSM White</option>
                      <option value="Bond Paper">Bond Paper (Executive)</option>
                      <option value="Glossy">Glossy Photo Paper</option>
                      <option value="Executive">Executive 100 GSM</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Page Range</Label>
                <Input
                  placeholder="e.g. All, or 1-5, 8"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  className="h-9 text-xs bg-card border-border rounded-lg"
                />
              </div>
            </div>

            {/* Live Pricing Summary Card */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-primary/20">
              <div>
                <span className="text-[10px] font-semibold text-primary uppercase font-mono">Dynamic Price Total</span>
                <p className="text-xl font-heading font-bold text-foreground">
                  ₹{totalPrice.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {pageCount} page(s) × {copies} cop(ies) • {colorMode} • {duplex}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep('preview')}
                  className="rounded-lg text-xs font-medium"
                >
                  Inspect Preview
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecutePrint}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg px-4 gap-1.5 shadow-md shadow-primary/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Execute Print</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PRINT PREVIEW */}
        {currentStep === 'preview' && (
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-heading font-bold uppercase text-foreground">Print Sheet Preview</h3>
                <p className="text-xs text-muted-foreground">
                  Visual layout before hardware submission to {activePrinter?.name}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep('configure')}
                className="text-xs rounded-lg"
              >
                Back to Settings
              </Button>
            </div>

            {/* Simulated Paper Sheet Preview */}
            <div className="flex justify-center p-6 bg-muted/60 rounded-xl border border-border">
              <div className="w-64 h-88 aspect-[1/1.41] bg-card border border-border shadow-lg p-6 flex flex-col justify-between text-foreground rounded-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-[10px] font-bold text-primary uppercase font-mono">printOn24 Spooler</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{paperSize}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-full" />
                    <div className="h-2.5 bg-muted rounded w-5/6" />
                    <div className="h-2.5 bg-muted rounded w-4/6" />
                  </div>
                </div>

                <div className="p-2 bg-muted/50 rounded text-[9px] font-mono text-muted-foreground space-y-0.5">
                  <p>Printer: {activePrinter?.name}</p>
                  <p>Mode: {colorMode} • {duplex}</p>
                  <p>Media: {paperType}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('configure')}
                className="text-xs rounded-lg"
              >
                Change Options
              </Button>
              <Button
                onClick={handleExecutePrint}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg px-4 gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Confirm & Send to Physical Printer</span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PHYSICAL HARDWARE SPOOLING IN PROGRESS */}
        {currentStep === 'printing' && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto animate-pulse">
              <Printer className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-2 max-w-sm mx-auto">
              <h3 className="text-base font-heading font-bold uppercase text-foreground">
                Hardware Spooling in Progress
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {printStatusMsg}
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-1.5">
              <Progress value={printProgress} className="h-2 rounded-full" />
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Spooling</span>
                <span>{printProgress}%</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Please do not disconnect the printer or close the counter agent.
            </p>
          </div>
        )}

        {/* STEP 4: PRINT COMPLETED RECEIPT */}
        {currentStep === 'completed' && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-heading font-bold uppercase text-foreground">
                Print Job Dispatched to Hardware!
              </h3>
              <p className="text-xs text-muted-foreground font-sans">
                The document has been transferred to the physical printer buffer.
              </p>
            </div>

            {/* Hardware Receipt */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-left font-mono text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between pb-1 border-b border-border">
                <span className="text-muted-foreground">Job Reference:</span>
                <strong className="text-foreground">{completedJobId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Printer:</span>
                <span className="text-foreground">{activePrinter?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Workstation:</span>
                <span className="text-foreground">{activePc?.pc_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span className="text-foreground">{pageCount * copies} sheets ({colorMode}, {duplex})</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="font-semibold text-foreground">Amount:</span>
                <span className="font-bold text-primary font-heading text-sm">₹{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep('configure');
                  setIsGoForPrintOpen(false);
                }}
                className="text-xs rounded-lg"
              >
                Close Dialog
              </Button>
              <Button
                onClick={() => {
                  setCurrentStep('configure');
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg px-4 gap-1.5"
              >
                Print Another Job
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
