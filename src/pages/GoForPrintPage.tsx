import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  FileText,
  Monitor,
  User,
  Phone,
  Check,
  ChevronRight,
  ExternalLink,
  Sliders,
  Sparkles,
  Zap,
  Download,
  Terminal,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { localPrintAgent } from '@/services/localPrintAgent';
import type { PrintOrder, ShopPrinter } from '@/types/shopkeeper';

export const GoForPrintPage: React.FC = () => {
  const { user, selectedPcId, setSelectedPcId, pcs, realPrinters, agentStatus, refreshPrinters, t } =
    useShopkeeper();

  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  // Fetch live print requests from Supabase
  const fetchLiveQueue = useCallback(async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const data = await shopkeeperApi.getLiveOrders(user.shop_id, selectedPcId);
      setOrders(data);
    } catch (err) {
      console.error('Error fetching live queue:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.shop_id, selectedPcId]);

  useEffect(() => {
    fetchLiveQueue();
    if (user?.shop_id) {
      localPrintAgent.setShopCredentials(user.shop_id);
    }
  }, [fetchLiveQueue, user?.shop_id]);

  // Subscribe to real-time order updates
  useEffect(() => {
    if (!user?.shop_id) return;
    const unsub = shopkeeperApi.subscribeToOrders(user.shop_id, () => {
      fetchLiveQueue();
    });
    return () => {
      unsub.unsubscribe();
    };
  }, [user?.shop_id, fetchLiveQueue]);

  // Current PC object
  const currentPc = useMemo(() => {
    if (selectedPcId === 'all') return null;
    return pcs.find((p) => p.id === selectedPcId) || null;
  }, [pcs, selectedPcId]);

  // Available online printers mapped to this shop / PC
  const onlinePrinters = useMemo(() => {
    // If a specific PC is selected and it is disabled, it cannot receive new jobs
    if (currentPc && currentPc.is_enabled === false) {
      return [];
    }

    return realPrinters.filter((prn) => {
      if (prn.status === 'offline') return false;
      if (selectedPcId && selectedPcId !== 'all' && prn.pc_id && prn.pc_id !== selectedPcId) {
        return false;
      }
      // If printer is mapped to a specific PC, verify that PC is enabled
      if (prn.pc_id) {
        const mappedPc = pcs.find((p) => p.id === prn.pc_id);
        if (mappedPc && mappedPc.is_enabled === false) {
          return false;
        }
      }
      return true;
    });
  }, [realPrinters, selectedPcId, currentPc, pcs]);

  // PRINT MATCHING LOGIC (SRS Section 5)
  // Compares User Print Configuration against Real Connected Printer Capabilities
  const evaluatePrinterMatch = useCallback(
    (order: PrintOrder): { isCompatible: boolean; matchedPrinter: ShopPrinter | null; reason?: string } => {
      if (onlinePrinters.length === 0) {
        return {
          isCompatible: false,
          matchedPrinter: null,
          reason: 'No physical printers are currently connected or online.',
        };
      }

      const matchRes = shopkeeperApi.findCompatiblePrinterForOrder(order, onlinePrinters);
      if (matchRes.compatiblePrinter) {
        return {
          isCompatible: true,
          matchedPrinter: matchRes.compatiblePrinter,
        };
      }

      return {
        isCompatible: false,
        matchedPrinter: null,
        reason: matchRes.reasonIfNotCompatible || 'Order requirements (paper size, color, duplex) do not match any online physical printer.',
      };
    },
    [onlinePrinters]
  );

  // 4.1 PRINTER DISAMBIGUATION STATE (When multiple printers match the same config)
  const [disambiguationOrder, setDisambiguationOrder] = useState<{
    order: PrintOrder;
    matchingPrinters: ShopPrinter[];
  } | null>(null);

  // Trigger print with automatic disambiguation check
  const handleInitiatePrint = (order: PrintOrder) => {
    const matchRes = shopkeeperApi.findCompatiblePrinterForOrder(order, onlinePrinters);
    if (matchRes.compatiblePrinters && matchRes.compatiblePrinters.length > 1) {
      // Multiple printers match identical configuration: show selection card
      setDisambiguationOrder({
        order,
        matchingPrinters: matchRes.compatiblePrinters,
      });
    } else if (matchRes.compatiblePrinter) {
      // Exactly one printer matches: print on it automatically without showing the card
      handleOneClickPrint(order, matchRes.compatiblePrinter);
    } else {
      toast.error('No compatible printer available for this order configuration.');
    }
  };

  // ONE-CLICK DIRECT PRINT EXECUTION
  // When Admin clicks Print, printing starts DIRECTLY in one click without any extra modal/preview/dialog
  const handleOneClickPrint = async (order: PrintOrder, matchedPrinter: ShopPrinter) => {
    if (!user?.shop_id) return;
    setPrintingOrderId(order.id);

    toast.info(`Spooling job to ${matchedPrinter.name}...`, {
      description: `${order.config_copies} copies • ${order.config_page_size} • ${order.config_print_type} • ${order.config_sides}`,
    });

    try {
      const activePcId = currentPc?.id || order.target_pc_id || pcs[0]?.id || 'pc_01';

      const result = await shopkeeperApi.executeDirectOneClickPrint({
        order,
        matchedPrinter,
        pcId: activePcId,
      });

      if (result.success) {
        toast.success(result.message || `Printed directly on ${matchedPrinter.name}!`, {
          description: `Order Token #${order.token_number} (${order.document_name}) completed.`,
        });
        // Optimistically update local order state
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, order_status: 'Completed' } : o))
        );
      } else {
        toast.error('Direct print failed', {
          description: result.message,
        });
      }
    } catch (err: any) {
      toast.error('Printing error', {
        description: err?.message || 'Failed to dispatch to physical printer.',
      });
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    if (tabFilter === 'pending') {
      return orders.filter((o) => o.order_status !== 'Completed' && o.order_status !== 'Cancelled');
    }
    if (tabFilter === 'completed') {
      return orders.filter((o) => o.order_status === 'Completed');
    }
    return orders;
  }, [orders, tabFilter]);

  const pendingCount = orders.filter(
    (o) => o.order_status !== 'Completed' && o.order_status !== 'Cancelled'
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header with Real-Time Device Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-heading uppercase font-bold text-muted-foreground tracking-wide">
              Live Hardware Execution
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-extrabold tracking-tight text-foreground uppercase flex items-center gap-2">
            <span>Go For Print</span>
            <Badge className="bg-primary text-primary-foreground font-mono text-xs rounded-md">
              One-Click Direct
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Real-time incoming customer submissions matched against connected physical printers for instant one-click execution.
          </p>
        </div>

        {/* Workstation & Hardware Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Terminal Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 border border-border rounded-lg text-xs font-mono">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <select
              value={selectedPcId}
              onChange={(e) => setSelectedPcId(e.target.value)}
              className="bg-transparent border-none text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Terminals</option>
              {pcs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pc_name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* QZ Tray Silent Print Integration Trigger Button */}
          <button
            type="button"
            onClick={() => setAgentModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all hover:opacity-90 ${
              agentStatus.connected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
            title="Click to view QZ Tray connection status & setup"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                agentStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{agentStatus.connected ? 'QZ Tray Active' : 'QZ Tray Offline'}</span>
            <Activity className="w-3.5 h-3.5 opacity-70 ml-0.5" />
          </button>

          {/* Online Hardware Count */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 border border-border rounded-lg text-xs font-mono">
            <Printer className="w-3.5 h-3.5 text-primary" />
            <span>
              {onlinePrinters.length} {onlinePrinters.length === 1 ? 'Printer' : 'Printers'} Online
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchLiveQueue();
              refreshPrinters();
            }}
            disabled={loading}
            className="h-9 text-xs rounded-lg gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Queue Filter Tabs & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTabFilter('pending')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              tabFilter === 'pending'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <span>Live Queue</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                tabFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabFilter('completed')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-lg transition-all ${
              tabFilter === 'completed'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            Completed Jobs
          </button>

          <button
            type="button"
            onClick={() => setTabFilter('all')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-lg transition-all ${
              tabFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            All Requests
          </button>
        </div>

        <div className="text-xs text-muted-foreground font-sans flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>One-Click direct spooling to physical Windows/Linux/Mac printers enabled</span>
        </div>
      </div>

      {/* LIVE PRINT REQUEST CARDS (ONE-CLICK DIRECT EXECUTION) */}
      {loading && orders.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs font-mono text-muted-foreground">Connecting to real-time database queue...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="bg-card border-border rounded-xl p-12 text-center">
          <Printer className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-sm font-heading font-bold uppercase text-foreground">
            No Print Requests in Queue
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Customer submissions uploaded via the Shop QR or User Panel appear here instantaneously.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const { isCompatible, matchedPrinter, reason } = evaluatePrinterMatch(order);
            const isCompleted = order.order_status === 'Completed';
            const isCurrentlyPrinting = printingOrderId === order.id || order.order_status === 'Printing';

            return (
              <Card
                key={order.id}
                className={`border transition-all rounded-xl overflow-hidden ${
                  isCompleted
                    ? 'bg-muted/20 border-border opacity-85'
                    : isCompatible
                    ? 'bg-card border-border hover:border-primary/50 shadow-sm'
                    : 'bg-amber-500/[0.03] border-amber-500/30 shadow-sm'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Section: Token, Customer & Document */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Token Number Box */}
                    <div className="w-14 h-14 rounded-xl bg-muted/60 border border-border flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] uppercase font-mono text-muted-foreground">Token</span>
                      <span className="text-lg font-heading font-black text-primary leading-none mt-0.5">
                        {order.token_number}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-heading font-bold text-foreground truncate max-w-xs sm:max-w-md">
                          {order.document_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono border-border">
                          {order.file_type?.includes('pdf') ? 'PDF' : 'IMAGE'}
                        </Badge>
                        <Badge
                          className={`text-[10px] font-mono ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                              : isCurrentlyPrinting
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30 animate-pulse'
                              : 'bg-primary/10 text-primary border border-primary/30'
                          }`}
                        >
                          {order.order_status}
                        </Badge>
                      </div>

                      {/* Customer info & order number */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{order.order_number}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-foreground font-medium">
                          <User className="w-3 h-3 text-primary" />
                          {order.customer_name || order.user_name || 'Walk-in Customer'}
                        </span>
                        {(order.customer_phone || order.user_phone) && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {order.customer_phone || order.user_phone}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Print Configuration Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[11px] border font-semibold ${
                            order.config_print_type === 'Colour'
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-muted text-foreground border-border'
                          }`}
                        >
                          {order.config_print_type}
                        </span>

                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-muted border border-border text-foreground">
                          {order.config_sides}
                        </span>

                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-muted border border-border text-foreground">
                          {order.config_page_size} • {order.config_paper_type}
                        </span>

                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-muted border border-border text-foreground">
                          {order.config_copies} {order.config_copies > 1 ? 'Copies' : 'Copy'} ({order.total_pages} pgs)
                        </span>

                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          ₹{order.grand_total}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right Section: Hardware Match Status & ONE-CLICK DIRECT PRINT ACTION */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
                    {/* Hardware Compatibility Indicator (SRS Section 5) */}
                    <div className="text-left sm:text-right space-y-1">
                      {isCompatible && matchedPrinter ? (
                        <div className="space-y-0.5">
                          <div className="flex sm:justify-end items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Matched Printer:</span>
                          </div>
                          <p className="text-xs font-mono font-bold text-foreground">
                            {matchedPrinter.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            via {matchedPrinter.connection_type.toUpperCase()} • Ready
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-sans text-[11px] font-semibold"
                          >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            No Compatible Printer Available
                          </Badge>
                          <p className="text-[10px] text-muted-foreground font-sans max-w-xs">
                            {reason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* DIRECT ONE-CLICK PRINT ACTION BUTTON */}
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toast.info('This job has already been printed')}
                          className="h-10 text-xs font-semibold rounded-lg bg-muted text-muted-foreground gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Printed</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleInitiatePrint(order)}
                          disabled={!isCompatible || isCurrentlyPrinting}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-extrabold rounded-lg h-10 px-5 gap-2 shadow-md shadow-primary/25 transition-transform active:scale-95"
                          title={
                            isCompatible
                              ? `Direct 1-Click print`
                              : 'Connect a compatible printer first'
                          }
                        >
                          {isCurrentlyPrinting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Sending to Hardware...</span>
                            </>
                          ) : (
                            <>
                              <Printer className="w-4 h-4" />
                              <span>Print (1-Click)</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4.1 PRINTER DISAMBIGUATION MODAL (When multiple printers match the same config) */}
      <Dialog
        open={Boolean(disambiguationOrder)}
        onOpenChange={(open) => !open && setDisambiguationOrder(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-2xl bg-card border border-border p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <span>Select Target Printer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Multiple configured printers match this document's requirements. Choose which printer to dispatch this job to:
            </DialogDescription>
          </DialogHeader>

          {disambiguationOrder && (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs space-y-1">
                <p className="font-semibold text-foreground">
                  Document: {disambiguationOrder.order.document_name}
                </p>
                <p className="text-muted-foreground">
                  Config: {disambiguationOrder.order.config_page_size} • {disambiguationOrder.order.config_print_type} • {disambiguationOrder.order.config_sides} • {disambiguationOrder.order.config_copies} copy
                </p>
              </div>

              <div className="space-y-2">
                {disambiguationOrder.matchingPrinters.map((prn) => (
                  <div
                    key={prn.id}
                    className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-foreground">{prn.name}</span>
                        {prn.is_default && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {prn.model} • via {prn.connection_type.toUpperCase()} • {prn.is_color ? 'Color & B&W' : 'B&W Only'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        const currentOrd = disambiguationOrder.order;
                        setDisambiguationOrder(null);
                        handleOneClickPrint(currentOrd, prn);
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-3.5 shrink-0"
                    >
                      Select &amp; Print
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* QZ TRAY CONFIGURATION & SETUP MODAL */}
      <Dialog open={agentModalOpen} onOpenChange={setAgentModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl p-6 rounded-2xl bg-card border border-border font-sans">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-heading uppercase font-bold text-muted-foreground tracking-wide">
                Direct Silent Printing Engine
              </span>
            </div>
            <DialogTitle className="text-xl font-heading font-extrabold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <span>QZ Tray Silent Print Integration</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Connects directly to official QZ Tray via WebSocket for physical printing with zero browser preview dialogs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Status Card */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                agentStatus.connected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      agentStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span>
                    {agentStatus.connected
                      ? 'QZ Tray is Active (qz.websocket.isActive() = true)'
                      : 'QZ Tray is Offline / Not Running'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Engine: QZ Tray {agentStatus.agent_version || 'v2.2.6'} • Detected Printers:{' '}
                  {agentStatus.detected_printers_count} Physical Devices
                </p>
              </div>

              <Badge
                variant="outline"
                className={`text-[10px] font-mono uppercase ${
                  agentStatus.connected ? 'border-emerald-500/50 text-emerald-600' : 'border-amber-500/50 text-amber-600'
                }`}
              >
                {agentStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}
              </Badge>
            </div>

            {/* How QZ Tray works */}
            <div className="space-y-2">
              <h4 className="text-xs font-heading font-bold uppercase text-foreground flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-primary" />
                How to Setup QZ Tray for Direct Silent Printing:
              </h4>

              <div className="bg-muted/60 p-3.5 rounded-lg border border-border space-y-2.5 text-xs text-foreground font-sans">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-semibold">Download & Install QZ Tray</p>
                    <p className="text-muted-foreground text-[11px]">
                      Download QZ Tray from the official portal and run the installer on your PC.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-semibold">Launch QZ Tray</p>
                    <p className="text-muted-foreground text-[11px]">
                      Open QZ Tray. It runs quietly in your Windows system tray near the clock (green zebra icon).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">Instant Direct Printing</p>
                    <p className="text-muted-foreground text-[11px]">
                      Clicking <strong>GO FOR PRINT</strong> dispatches jobs directly through QZ Tray to physical paper without opening browser print dialogs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <a href="/QZ.Setup.md" download="QZ.Setup.md">
                  <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1.5 text-primary">
                    <Download className="w-3.5 h-3.5" />
                    <span>QZ.Setup.md मार्गदर्शक</span>
                  </Button>
                </a>
                <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Download QZ Tray</span>
                  </Button>
                </a>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  const list = await localPrintAgent.enumeratePrinters();
                  refreshPrinters();
                  if (list.length > 0) {
                    toast.success(`Connected to QZ Tray! Detected ${list.length} printer(s).`);
                  } else {
                    toast.info('Queried QZ Tray. Make sure QZ Tray is running.');
                  }
                }}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Test & Refresh Connection</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoForPrintPage;
