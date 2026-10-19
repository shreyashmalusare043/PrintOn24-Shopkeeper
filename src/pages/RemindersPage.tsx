import React, { useState, useEffect, useCallback } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { supabase } from '@/services/supabase';
import type { PrinterReminder, PrinterRefillLog, PrinterPrintMode } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  History,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

export const RemindersPage: React.FC = () => {
  const { user } = useShopkeeper();

  const [printers, setPrinters] = useState<PrinterReminder[]>([]);
  const [refillLogs, setRefillLogs] = useState<PrinterRefillLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal State
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState('');
  const [printMode, setPrintMode] = useState<PrinterPrintMode>('both');
  const [bwLimit, setBwLimit] = useState<number>(1000);
  const [colorLimit, setColorLimit] = useState<number>(500);
  const [bwThreshold, setBwThreshold] = useState<number>(50);
  const [colorThreshold, setColorThreshold] = useState<number>(50);
  const [cartridgeNotes, setCartridgeNotes] = useState('');
  const [savingPrinter, setSavingPrinter] = useState(false);

  // Refill / Cycle Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetPrinter, setTargetPrinter] = useState<PrinterReminder | null>(null);
  const [resetCounterType, setResetCounterType] = useState<'bw' | 'color' | 'both'>('both');
  const [resetNotes, setResetNotes] = useState('');
  const [processingReset, setProcessingReset] = useState(false);

  // Card-specific inline edits state
  const [cardEdits, setCardEdits] = useState<{ [id: string]: Partial<PrinterReminder> }>({});

  const handleCardFieldChange = (printerId: string, field: keyof PrinterReminder, value: number) => {
    setCardEdits((prev) => ({
      ...prev,
      [printerId]: {
        ...(prev[printerId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveCardSettings = async (printer: PrinterReminder) => {
    if (!user?.shop_id) return;
    const edits = cardEdits[printer.id] || {};
    const updatedPayload: Partial<PrinterReminder> = {
      ...printer,
      ...edits,
      shop_id: user.shop_id,
    };
    const ok = await shopkeeperApi.savePrinterReminder(user.shop_id, updatedPayload);
    if (ok) {
      toast.success(`Settings saved for "${printer.printer_name}"`);
      setCardEdits((prev) => {
        const copy = { ...prev };
        delete copy[printer.id];
        return copy;
      });
      await loadData();
    } else {
      toast.error('Failed to save printer settings');
    }
  };

  const handleResetPageReminder = async (printer: PrinterReminder) => {
    if (!user?.shop_id) return;
    const count = printer.current_print_count || 0;
    const ok = await shopkeeperApi.resetPrinterReminderCycle(
      user.shop_id,
      printer.id,
      printer.printer_name,
      'bw',
      count,
      `Page Reminder cycle restarted from card at ${count} prints`
    );
    if (ok) {
      toast.success(`Page reminder cycle reset for "${printer.printer_name}"! Count set to 0.`);
      await loadData();
    } else {
      toast.error('Failed to reset page reminder');
    }
  };

  const handleResetInkReminder = async (printer: PrinterReminder) => {
    if (!user?.shop_id) return;
    const count = printer.color_printed_count || 0;
    const ok = await shopkeeperApi.resetPrinterReminderCycle(
      user.shop_id,
      printer.id,
      printer.printer_name,
      'color',
      count,
      `Ink Reminder cycle restarted from card at ${count} prints`
    );
    if (ok) {
      toast.success(`Ink reminder cycle reset for "${printer.printer_name}"! Count set to 0.`);
      await loadData();
    } else {
      toast.error('Failed to reset ink reminder');
    }
  };

  // Load live data from Supabase
  const loadData = useCallback(async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const [printerData, logsData] = await Promise.all([
        shopkeeperApi.getPrinterReminders(user.shop_id),
        shopkeeperApi.getPrinterReminderLogs(user.shop_id),
      ]);
      setPrinters(printerData);
      setRefillLogs(logsData);
    } catch {
      toast.error('Failed to load printer reminders from database');
    } finally {
      setLoading(false);
    }
  }, [user?.shop_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization via Supabase channel subscriptions
  useEffect(() => {
    if (!user?.shop_id) return;

    const channel = supabase
      .channel(`reminders_live_${user.shop_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_reminders', filter: `shop_id=eq.${user.shop_id}` },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_orders', filter: `shop_id=eq.${user.shop_id}` },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.shop_id, loadData]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingPrinterId(null);
    setPrinterName('');
    setPrintMode('both');
    setBwLimit(1000);
    setColorLimit(500);
    setBwThreshold(50);
    setColorThreshold(50);
    setCartridgeNotes('');
    setShowPrinterModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (p: PrinterReminder) => {
    setEditingPrinterId(p.id);
    setPrinterName(p.printer_name);
    setPrintMode(p.print_mode || 'both');
    setBwLimit(p.bw_limit || 1000);
    setColorLimit(p.color_limit || 500);
    setBwThreshold(p.bw_threshold || 50);
    setColorThreshold(p.color_threshold || 50);
    setCartridgeNotes(p.cartridge_notes || '');
    setShowPrinterModal(true);
  };

  // Save Printer (Add or Edit)
  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.shop_id) return;
    if (!printerName.trim()) {
      toast.error('Printer name is required');
      return;
    }

    if ((printMode === 'bw' || printMode === 'both') && bwLimit <= 0) {
      toast.error('B&W capacity limit must be greater than 0');
      return;
    }
    if ((printMode === 'color' || printMode === 'both') && colorLimit <= 0) {
      toast.error('Color capacity limit must be greater than 0');
      return;
    }

    setSavingPrinter(true);
    try {
      const payload: Partial<PrinterReminder> = {
        id: editingPrinterId || undefined,
        shop_id: user.shop_id,
        printer_name: printerName.trim(),
        print_mode: printMode,
        bw_limit: bwLimit,
        color_limit: colorLimit,
        bw_threshold: bwThreshold > 0 ? bwThreshold : 50,
        color_threshold: colorThreshold > 0 ? colorThreshold : 50,
        cartridge_notes: cartridgeNotes.trim() || 'Standard toner/ink refill',
      };

      const ok = await shopkeeperApi.savePrinterReminder(user.shop_id, payload);
      if (ok) {
        toast.success(editingPrinterId ? 'Printer configuration updated!' : 'New printer added to tracking system!');
        setShowPrinterModal(false);
        await loadData();
      } else {
        toast.error('Failed to save printer details');
      }
    } finally {
      setSavingPrinter(false);
    }
  };

  // Delete / Permanently Remove Printer Reminder
  const handleDeletePrinter = async (p: PrinterReminder) => {
    if (!confirm(`Are you sure you want to permanently delete reminder for "${p.printer_name}"? This will permanently remove it from active monitoring.`)) {
      return;
    }
    try {
      // Optimistically update local state immediately so UI updates with zero delay
      setPrinters((prev) => prev.filter((item) => item.id !== p.id));
      const ok = await shopkeeperApi.deletePrinterReminder(p.id);
      if (ok) {
        toast.success(`Reminder for "${p.printer_name}" permanently deleted`);
        await loadData();
      } else {
        toast.error('Failed to permanently delete reminder from database');
        await loadData();
      }
    } catch {
      toast.error('Failed to delete printer reminder');
      await loadData();
    }
  };

  // Open Refill / Cycle Reset Dialog
  const handleOpenResetDialog = (p: PrinterReminder, initialCounter?: 'bw' | 'color' | 'both') => {
    setTargetPrinter(p);
    if (initialCounter) {
      setResetCounterType(initialCounter);
    } else if (p.print_mode === 'bw') {
      setResetCounterType('bw');
    } else if (p.print_mode === 'color') {
      setResetCounterType('color');
    } else {
      setResetCounterType('both');
    }
    setResetNotes('');
    setResetModalOpen(true);
  };

  // Execute Refill / Cycle Reset
  const handleConfirmReset = async () => {
    if (!user?.shop_id || !targetPrinter) return;

    setProcessingReset(true);
    try {
      const printsDone =
        resetCounterType === 'bw'
          ? targetPrinter.bw_printed_count
          : resetCounterType === 'color'
          ? targetPrinter.color_printed_count
          : targetPrinter.bw_printed_count + targetPrinter.color_printed_count;

      const ok = await shopkeeperApi.resetPrinterReminderCycle(
        user.shop_id,
        targetPrinter.id,
        targetPrinter.printer_name,
        resetCounterType,
        printsDone,
        resetNotes.trim() || undefined
      );

      if (ok) {
        toast.success(
          `Cycle reset for "${targetPrinter.printer_name}"! Active reminder cleared and logged in history.`
        );
        setResetModalOpen(false);
        await loadData();
      } else {
        toast.error('Failed to reset printer cycle');
      }
    } finally {
      setProcessingReset(false);
    }
  };

  // Evaluate reminders and threshold triggers for all printers
  interface ActiveAlert {
    printer: PrinterReminder;
    type: 'page' | 'ink';
    label: string;
    printed: number;
    threshold: number;
    remaining: number;
    isExceeded: boolean;
  }

  const activeAlerts: ActiveAlert[] = [];

  printers.forEach((p) => {
    const pageCount = cardEdits[p.id]?.current_print_count ?? p.current_print_count ?? p.bw_printed_count ?? 0;
    const pageThreshold = cardEdits[p.id]?.page_threshold ?? p.page_threshold ?? 1800;
    const pageExceeded = pageCount >= pageThreshold && pageThreshold > 0;

    if (pageExceeded) {
      activeAlerts.push({
        printer: p,
        type: 'page',
        label: 'Page Capacity Limit',
        printed: pageCount,
        threshold: pageThreshold,
        remaining: Math.max(0, pageThreshold - pageCount),
        isExceeded: true,
      });
    }

    const isColor = p.is_color ?? (p.print_mode === 'color' || p.print_mode === 'both');
    const inkCount = cardEdits[p.id]?.color_printed_count ?? p.color_printed_count ?? 0;
    const inkThreshold = cardEdits[p.id]?.color_threshold ?? p.color_threshold ?? 1500;
    const inkExceeded = isColor && inkCount >= inkThreshold && inkThreshold > 0;

    if (inkExceeded) {
      activeAlerts.push({
        printer: p,
        type: 'ink',
        label: 'Ink / Color Limit',
        printed: inkCount,
        threshold: inkThreshold,
        remaining: Math.max(0, inkThreshold - inkCount),
        isExceeded: true,
      });
    }
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Hardware Consumables &amp; Print Monitoring
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Printer Reminders &amp; Page Capacity Tracking
          </h1>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            Monitor real print activity for each configured printer. Set page capacity and ink thresholds with automated global alerts and cycle restarts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold rounded-lg h-8 px-3 gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Printer</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs rounded-lg gap-1.5 h-8 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2.3 Reminder Trigger Alerts (Global Page & Ink threshold notifications) */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          {activeAlerts.map((alert, idx) => (
            <div
              key={`${alert.printer.id}_${alert.type}_${idx}`}
              className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm bg-destructive/10 border-destructive/40 text-destructive"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-xs uppercase tracking-wide">
                      {alert.type === 'page' ? 'Page Reminder • Threshold Reached' : 'Ink Reminder • Threshold Reached'}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 border-destructive text-destructive">
                      {alert.label}
                    </Badge>
                  </div>
                  <p className="text-xs font-sans mt-1">
                    Printer <strong>&ldquo;{alert.printer.printer_name}&rdquo;</strong> has reached or exceeded its configured {alert.label.toLowerCase()} ({alert.printed.toLocaleString()} of {alert.threshold.toLocaleString()} pages).{' '}
                    <span className="font-bold underline">Reminder limit reached. Restart cycle after restocking.</span>
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  alert.type === 'page'
                    ? handleResetPageReminder(alert.printer)
                    : handleResetInkReminder(alert.printer)
                }
                className="text-xs h-8 rounded-lg font-heading font-bold shrink-0 self-end sm:self-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cycle Restart</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 2.1 & 2.2 Printer-based Page Capacity Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            <span>Configured Printers &amp; Capacity Reminders ({printers.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Synced with real hardware print jobs
          </span>
        </div>

        {printers.length === 0 ? (
          <Card className="bg-card border-border rounded-xl p-8 text-center">
            <Printer className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <h3 className="font-heading font-bold text-sm text-foreground uppercase">No Printers Configured Yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              Add your shop&apos;s printers in Printer Configuration or here to start monitoring page capacity and ink reminders.
            </p>
            <Button
              onClick={handleOpenAddModal}
              className="bg-primary text-primary-foreground text-xs font-heading font-bold h-8 rounded-lg px-4 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Printer</span>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map((printer) => {
              const currentEdits = cardEdits[printer.id] || {};
              const pageCountVal = currentEdits.current_print_count ?? printer.current_print_count ?? printer.bw_printed_count ?? 0;
              const pageThresholdVal = currentEdits.page_threshold ?? printer.page_threshold ?? 1800;
              const isPageExceeded = pageCountVal >= pageThresholdVal && pageThresholdVal > 0;
              const pagePercent = Math.min(100, Math.round((pageCountVal / Math.max(1, pageThresholdVal)) * 100));

              const isColorPrinter = printer.is_color ?? (printer.print_mode === 'color' || printer.print_mode === 'both');
              const inkCountVal = currentEdits.color_printed_count ?? printer.color_printed_count ?? 0;
              const inkThresholdVal = currentEdits.color_threshold ?? printer.color_threshold ?? 1500;
              const isInkExceeded = isColorPrinter && inkCountVal >= inkThresholdVal && inkThresholdVal > 0;
              const inkPercent = Math.min(100, Math.round((inkCountVal / Math.max(1, inkThresholdVal)) * 100));

              const connType = printer.connection_type || 'USB';
              const hasUnsavedEdits = !!cardEdits[printer.id];

              return (
                <Card
                  key={printer.id}
                  className="bg-card border-border rounded-xl shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Printer className="w-4 h-4 text-primary shrink-0" />
                          <CardTitle className="text-sm font-heading font-bold uppercase text-foreground leading-snug truncate">
                            {printer.printer_name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono uppercase px-1.5 py-0 border-primary/40 text-primary"
                          >
                            {connType}
                          </Badge>
                          <Badge className="bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-mono px-1.5 py-0">
                            Online
                          </Badge>
                        </div>
                        {printer.cartridge_notes && (
                          <p className="text-[11px] text-muted-foreground font-sans line-clamp-1">
                            {printer.cartridge_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(printer)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-md"
                          title="Edit printer configuration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePrinter(printer)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-md"
                          title="Archive printer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4 text-xs font-sans flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Section 1: Page Capacity Reminder */}
                      <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-foreground" />
                            <span className="font-heading font-bold uppercase text-[11px] text-foreground">
                              Page Capacity Reminder
                            </span>
                          </div>
                          <Badge
                            className={`text-[9px] font-mono px-1.5 py-0 ${
                              isPageExceeded
                                ? 'bg-destructive text-destructive-foreground font-bold animate-pulse'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {isPageExceeded ? 'Limit Reached' : 'Tracking Active'}
                          </Badge>
                        </div>

                        {/* Page Count & Threshold inputs */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-muted-foreground block text-[10px] font-medium mb-1">
                              Current Page Count
                            </label>
                            <Input
                              type="number"
                              min={0}
                              value={pageCountVal}
                              onChange={(e) =>
                                handleCardFieldChange(printer.id, 'current_print_count', Number(e.target.value))
                              }
                              className="h-7 text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-muted-foreground block text-[10px] font-medium mb-1">
                              Reminder Threshold
                            </label>
                            <Input
                              type="number"
                              min={50}
                              step={50}
                              value={pageThresholdVal}
                              onChange={(e) =>
                                handleCardFieldChange(printer.id, 'page_threshold', Number(e.target.value))
                              }
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isPageExceeded ? 'bg-destructive' : 'bg-primary'
                              }`}
                              style={{ width: `${pagePercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>Printed: <strong>{pageCountVal.toLocaleString()}</strong> / {pageThresholdVal.toLocaleString()}</span>
                            <span>{pagePercent}%</span>
                          </div>
                        </div>

                        {/* Reset Page Reminder Button */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPageReminder(printer)}
                            className="h-7 text-[11px] rounded-lg font-heading font-bold gap-1 text-destructive hover:bg-destructive/10"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Page Reminder</span>
                          </Button>

                          {hasUnsavedEdits && (
                            <Button
                              size="sm"
                              onClick={() => handleSaveCardSettings(printer)}
                              className="h-7 text-[11px] rounded-lg font-heading font-bold px-2.5 bg-primary text-primary-foreground"
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Section 2: Ink Reminder settings (Fixed reminder section) */}
                      <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                            <span className="font-heading font-bold uppercase text-[11px] text-foreground">
                              Ink Reminder Settings
                            </span>
                          </div>
                          <Badge
                            className={`text-[9px] font-mono px-1.5 py-0 ${
                              isInkExceeded
                                ? 'bg-destructive text-destructive-foreground font-bold animate-pulse'
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            {isInkExceeded ? 'Ink Limit Reached' : 'Ink Monitoring'}
                          </Badge>
                        </div>

                        {/* Configured Color Capability from Printer Configuration */}
                        <div className="p-2 rounded bg-background border border-border/60 text-[11px] space-y-0.5">
                          <div className="text-muted-foreground text-[10px]">Configured Color Capability:</div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isColorPrinter ? 'bg-primary' : 'bg-muted-foreground'}`} />
                            <span>
                              {isColorPrinter
                                ? 'Color & B&W Dual Engine (CMYK)'
                                : 'Monochrome (Black Toner Only)'}
                            </span>
                          </div>
                        </div>

                        {/* Ink Count & Ink Threshold inputs */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-muted-foreground block text-[10px] font-medium mb-1">
                              Current Ink Pages
                            </label>
                            <Input
                              type="number"
                              min={0}
                              value={inkCountVal}
                              onChange={(e) =>
                                handleCardFieldChange(printer.id, 'color_printed_count', Number(e.target.value))
                              }
                              className="h-7 text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-muted-foreground block text-[10px] font-medium mb-1">
                              Ink Threshold
                            </label>
                            <Input
                              type="number"
                              min={50}
                              step={50}
                              value={inkThresholdVal}
                              onChange={(e) =>
                                handleCardFieldChange(printer.id, 'color_threshold', Number(e.target.value))
                              }
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Ink Progress bar */}
                        <div className="space-y-1">
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isInkExceeded ? 'bg-destructive' : 'bg-primary'
                              }`}
                              style={{ width: `${inkPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>Printed: <strong>{inkCountVal.toLocaleString()}</strong> / {inkThresholdVal.toLocaleString()}</span>
                            <span>{inkPercent}%</span>
                          </div>
                        </div>

                        {/* Reset Ink Reminder Button */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetInkReminder(printer)}
                            className="h-7 text-[11px] rounded-lg font-heading font-bold gap-1 text-primary hover:bg-primary/10"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Ink Reminder</span>
                          </Button>

                          {hasUnsavedEdits && (
                            <Button
                              size="sm"
                              onClick={() => handleSaveCardSettings(printer)}
                              className="h-7 text-[11px] rounded-lg font-heading font-bold px-2.5 bg-primary text-primary-foreground"
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 2.4 Refill History Log (Immutable Audit Log from shop_reminder_logs) */}
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <span>Printer Refill &amp; Cycle Reset History Log</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-sans">
                Permanent audit trail recorded every time a printer cycle is reset after an ink or toner refill.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono self-start sm:self-center">
              {refillLogs.length} Refill Log{refillLogs.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto bg-card">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-heading font-bold text-[11px] text-muted-foreground uppercase">
                  <th className="py-2.5 px-4 whitespace-nowrap">Timestamp</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Printer Name</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Counter Reset</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Prints in Cycle</th>
                  <th className="py-2.5 px-4">Refill Notes</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refillLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                      No refill reset logs recorded yet. Resets will be recorded here automatically.
                    </td>
                  </tr>
                ) : (
                  refillLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-muted-foreground text-[11px]">
                        {new Date(log.reset_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-heading font-bold text-foreground">
                        {log.printer_name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {log.counter_type === 'bw'
                            ? 'Black & White'
                            : log.counter_type === 'color'
                            ? 'Color'
                            : 'B&W & Color (Both)'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-foreground">
                        {(log.prints_done || 0).toLocaleString()} prints
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs font-sans max-w-md">
                        {log.notes || 'Consumable refilled and cycle reset'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold rounded-md gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Refill Completed
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 2.1 Add / Edit Printer Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 font-sans">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-bold text-sm uppercase text-foreground flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary" />
                <span>{editingPrinterId ? 'Edit Printer Configuration' : 'Add Monitored Printer'}</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPrinterModal(false)}
                className="h-7 w-7 p-0 rounded-md"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSavePrinter} className="p-4 space-y-3.5 text-xs font-sans">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Printer Name *</Label>
                <Input
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  placeholder="e.g. HP LaserJet 1, Canon imageRUNNER 2"
                  required
                  className="text-xs h-9 rounded-lg"
                />
              </div>

              {/* Supported Print Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Supported Print Mode *</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintMode('bw')}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      printMode === 'bw'
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    B&amp;W Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('color')}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      printMode === 'color'
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    Color Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('both')}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      printMode === 'both'
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    Both (B&amp;W + Color)
                  </button>
                </div>
              </div>

              {/* B&W Limits */}
              {(printMode === 'bw' || printMode === 'both') && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">B&amp;W Print Capacity Limit *</Label>
                    <Input
                      type="number"
                      min={50}
                      step={50}
                      value={bwLimit}
                      onChange={(e) => setBwLimit(Number(e.target.value))}
                      required
                      className="text-xs h-8 rounded-md font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">Prints before refill</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">B&amp;W Alert Threshold</Label>
                    <Input
                      type="number"
                      min={10}
                      step={10}
                      value={bwThreshold}
                      onChange={(e) => setBwThreshold(Number(e.target.value))}
                      required
                      className="text-xs h-8 rounded-md font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">Default: 50 prints</span>
                  </div>
                </div>
              )}

              {/* Color Limits */}
              {(printMode === 'color' || printMode === 'both') && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Color Print Capacity Limit *</Label>
                    <Input
                      type="number"
                      min={50}
                      step={50}
                      value={colorLimit}
                      onChange={(e) => setColorLimit(Number(e.target.value))}
                      required
                      className="text-xs h-8 rounded-md font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">Prints before refill</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Color Alert Threshold</Label>
                    <Input
                      type="number"
                      min={10}
                      step={10}
                      value={colorThreshold}
                      onChange={(e) => setColorThreshold(Number(e.target.value))}
                      required
                      className="text-xs h-8 rounded-md font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">Default: 50 prints</span>
                  </div>
                </div>
              )}

              {/* Ink / Cartridge Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Cartridge / Consumable Notes</Label>
                <Input
                  value={cartridgeNotes}
                  onChange={(e) => setCartridgeNotes(e.target.value)}
                  placeholder="e.g. HP 12A Black Toner, Canon C-EXV 54 CMYK"
                  className="text-xs h-9 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPrinterModal(false)}
                  className="h-8 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingPrinter}
                  className="bg-primary text-primary-foreground font-heading font-bold text-xs h-8 rounded-lg"
                >
                  {savingPrinter ? 'Saving...' : editingPrinterId ? 'Update Printer' : 'Save Printer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2.4 Refill / Cycle Reset Modal */}
      {resetModalOpen && targetPrinter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 font-sans">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-bold text-sm uppercase text-foreground flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" />
                <span>Refill / Cycle Reset</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetModalOpen(false)}
                className="h-7 w-7 p-0 rounded-md"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4 text-xs font-sans">
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                <div className="text-[11px] text-muted-foreground uppercase font-mono">Selected Hardware:</div>
                <div className="text-sm font-heading font-bold text-foreground">
                  {targetPrinter.printer_name}
                </div>
                <div className="text-[11px] text-muted-foreground font-sans">
                  Resetting the print counter clears the active threshold reminder and begins a new refill cycle.
                </div>
              </div>

              {/* Counter selection if printer supports both */}
              {targetPrinter.print_mode === 'both' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Which counter was refilled?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setResetCounterType('bw')}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        resetCounterType === 'bw'
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      B&amp;W Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetCounterType('color')}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        resetCounterType === 'color'
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      Color Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetCounterType('both')}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        resetCounterType === 'both'
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      Both Counters
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Refill Notes (Optional)</Label>
                <Input
                  value={resetNotes}
                  onChange={(e) => setResetNotes(e.target.value)}
                  placeholder="e.g. Installed new genuine cartridge from vendor"
                  className="text-xs h-9 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetModalOpen(false)}
                  className="h-8 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={processingReset}
                  onClick={handleConfirmReset}
                  className="bg-primary text-primary-foreground font-heading font-bold text-xs h-8 rounded-lg gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{processingReset ? 'Resetting Cycle...' : 'Confirm Refill & Reset'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemindersPage;
