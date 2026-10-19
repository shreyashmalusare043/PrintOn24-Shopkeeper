import React, { useState, useEffect, useMemo } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi, generateShopCode } from '@/services/shopkeeperApi';
import type { ShopPC, ShopQR, ShopSubscription } from '@/types/shopkeeper';
import QRCodeDataUrl from '@/components/ui/qrcodedataurl';
import QRCode from 'qrcode';
import { StandeePoster } from '@/components/standee/StandeePoster';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  QrCode,
  Monitor,
  Plus,
  Printer,
  Power,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Download,
  Send,
  HelpCircle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const getShopQrUrl = (shopCode: string) =>
  `https://printon24.in/shop/${encodeURIComponent(shopCode.trim().toUpperCase())}`;

export const QrPcManagementPage: React.FC = () => {
  const { user, shop, pcs, selectedPcId, setSelectedPcId, refreshShopData } = useShopkeeper();

  const [qrs, setQrs] = useState<ShopQR[]>([]);
  const [loadingQrs, setLoadingQrs] = useState(true);
  const [pcRequests, setPcRequests] = useState<any[]>([]);

  // Dynamic PC limit granted by Super Admin: either from shop.pc_limit or base (2) + approved extra PCs from Super Admin requests
  const approvedExtraPcs = useMemo(() => {
    return pcRequests
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + (Number(r.requested_pcs) || Number(r.requested_count) || 1), 0);
  }, [pcRequests]);

  const effectivePcLimit = Math.max(Number(shop?.pc_limit) || 2, 2 + approvedExtraPcs);
  const isLimitReached = pcs.length >= effectivePcLimit;

  // ADD PC MODAL
  const [addPcModalOpen, setAddPcModalOpen] = useState(false);
  const [newPcName, setNewPcName] = useState('');
  const [newPcIp, setNewPcIp] = useState('');
  const [savingPc, setSavingPc] = useState(false);

  // REQUEST ADDITIONAL PCS MODAL (Item 5)
  const [requestPcModalOpen, setRequestPcModalOpen] = useState(false);
  const [requestedPcCount, setRequestedPcCount] = useState(1);
  const [pcRequestReason, setPcRequestReason] = useState('');
  const [submittingPcRequest, setSubmittingPcRequest] = useState(false);

  // GENERATE DYNAMIC QR CODE MODAL
  const [generateQrModalOpen, setGenerateQrModalOpen] = useState(false);
  const [qrName, setQrName] = useState('Counter Front Standee');
  const [targetPcId, setTargetPcId] = useState<string>('');
  const [customShopCode, setCustomShopCode] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState(false);

  // PRINTABLE STANDEE MODAL
  const [printableQr, setPrintableQr] = useState<ShopQR | null>(null);
  const [standeeModalOpen, setStandeeModalOpen] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // DELETE PC CONFIRMATION STATE
  const [pcToDelete, setPcToDelete] = useState<ShopPC | null>(null);
  const [deletingPc, setDeletingPc] = useState(false);

  // Load dynamic QRs from database
  const loadQrs = async () => {
    if (!user?.shop_id) return;
    setLoadingQrs(true);
    try {
      const data = await shopkeeperApi.getShopQRs(user.shop_id);
      setQrs(data);
    } catch (err) {
      console.error('Error fetching dynamic QRs:', err);
    } finally {
      setLoadingQrs(false);
    }
  };

  const loadPcRequests = async () => {
    if (!user?.shop_id) return;
    try {
      const data = await shopkeeperApi.getShopPcRequests(user.shop_id);
      setPcRequests(data);
    } catch {
      // ignore
    }
  };

  const handleRequestMorePcs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.shop_id) return;
    setSubmittingPcRequest(true);
    try {
      const res = await shopkeeperApi.requestAdditionalPcs(
        user.shop_id,
        requestedPcCount,
        pcRequestReason
      );
      if (res.success) {
        toast.success(res.message);
        setRequestPcModalOpen(false);
        setPcRequestReason('');
        setRequestedPcCount(1);
        loadPcRequests();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Request failed: ${err?.message || err}`);
    } finally {
      setSubmittingPcRequest(false);
    }
  };

  useEffect(() => {
    if (user?.shop_id) {
      loadQrs();
      loadPcRequests();

      const unsubQrs = shopkeeperApi.subscribeToQRs(user.shop_id, () => {
        loadQrs();
      });

      // Realtime listener for Super Admin permission grants or PC request approvals
      const unsubPcChanges = shopkeeperApi.subscribeToShopPcChanges(user.shop_id, () => {
        refreshShopData();
        loadPcRequests();
      });

      return () => {
        unsubQrs.unsubscribe();
        unsubPcChanges.unsubscribe();
      };
    }
  }, [user?.shop_id]);

  // Open Generate QR Modal with standardized format: HE-344245-001
  const handleOpenGenerateQr = () => {
    const existingCodes = qrs.map((q) => q.shop_code).filter(Boolean);
    const defaultPc = pcs[0];
    setTargetPcId(defaultPc?.id || '');

    // Format: HE-344245-001 (HE = Shop 2 letters, 344245 = Fixed 6 digits, 001 = Serial)
    const code = generateShopCode(shop?.name || 'HE', 'PUNE', existingCodes);
    setCustomShopCode(code);
    setQrName(`Counter Standee #${qrs.length + 1}`);
    setGenerateQrModalOpen(true);
  };

  // Save generated dynamic QR Code to real database
  const handleSaveGeneratedQr = async () => {
    if (!user?.shop_id) return;
    if (!customShopCode.trim()) {
      toast.error('Please enter a valid Shop Code');
      return;
    }

    setGeneratingQr(true);
    try {
      const cleanCode = customShopCode.trim().toUpperCase();
      // QR encodes full direct URL for instant smartphone camera scanning
      const targetUrl = getShopQrUrl(cleanCode);

      await shopkeeperApi.createShopQR({
        shopId: user.shop_id,
        pcId: targetPcId || undefined,
        qrName: qrName.trim() || `Counter Standee ${cleanCode}`,
        shopCode: cleanCode,
        targetUrl,
      });

      toast.success(`Dynamic QR Code "${cleanCode}" generated and saved in database!`);
      await loadQrs();
      setGenerateQrModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate QR Code');
    } finally {
      setGeneratingQr(false);
    }
  };

  // Delete dynamic QR
  const handleDeleteQr = async (qr: ShopQR) => {
    if (!confirm(`Are you sure you want to delete QR "${qr.qr_name}" (${qr.shop_code})?`)) return;
    try {
      await shopkeeperApi.deleteShopQR(qr.id);
      toast.success('QR Code deleted.');
      await loadQrs();
    } catch {
      toast.error('Failed to delete QR');
    }
  };

  // Add PC terminal (Dynamic Limit based on Super Admin permissions)
  const handleAddPC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.shop_id) return;
    if (pcs.length >= effectivePcLimit) {
      toast.error(`Maximum limit reached: Only ${effectivePcLimit} PC terminals can be registered.`);
      return;
    }
    if (!newPcName.trim()) {
      toast.error('Please enter a PC name / terminal description');
      return;
    }

    setSavingPc(true);
    try {
      const res = await shopkeeperApi.addPC(user.shop_id, newPcName, newPcIp || undefined);
      if (res.success) {
        toast.success(`PC Terminal "${newPcName}" registered in database!`);
        setNewPcName('');
        setNewPcIp('');
        setAddPcModalOpen(false);
        await refreshShopData();
      } else {
        toast.error(res.error || 'Failed to add PC');
      }
    } finally {
      setSavingPc(false);
    }
  };

  const handleTogglePcEnabled = async (pc: ShopPC) => {
    const currentEnabled = pc.is_enabled !== false;
    const nextEnabled = !currentEnabled;
    try {
      const success = await shopkeeperApi.togglePcEnabled(pc.id, nextEnabled);
      if (success) {
        toast.success(`PC Terminal "${pc.pc_name}" ${nextEnabled ? 'enabled' : 'disabled'}`);
        await refreshShopData();
      } else {
        toast.error('Failed to update PC status');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update PC status');
    }
  };

  const handleSetCurrentPc = async (pc: ShopPC) => {
    if (!user?.shop_id) return;
    try {
      const success = await shopkeeperApi.setCurrentPc(user.shop_id, pc.id);
      if (success) {
        setSelectedPcId(pc.id);
        toast.success(`Active workstation set to ${pc.pc_name}`);
        await refreshShopData();
      } else {
        toast.error('Failed to set current PC');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error setting current PC');
    }
  };

  const handleConfirmDeletePc = async () => {
    if (!pcToDelete || !user?.shop_id) return;
    setDeletingPc(true);
    try {
      const res = await shopkeeperApi.deletePC(user.shop_id, pcToDelete.id);
      if (res.success) {
        toast.success(`PC Terminal "${pcToDelete.pc_name}" deleted.`);
        setPcToDelete(null);
        await refreshShopData();
      } else {
        toast.error(res.error || 'Failed to delete PC');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting PC');
    } finally {
      setDeletingPc(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // High-Resolution PNG Download (1024x1024)
  const handleDownloadQrPng = async (qr: ShopQR) => {
    try {
      const qrScanUrl = getShopQrUrl(qr.shop_code);
      const dataUrl = await QRCode.toDataURL(qrScanUrl, {
        width: 1024,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `PrintOn24_QR_${qr.shop_code}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`High-res PNG downloaded for ${qr.shop_code}`);
    } catch (err: any) {
      toast.error('Failed to generate high-resolution PNG: ' + (err?.message || 'Error'));
    }
  };

  // Clean White A4 Standee Print Handler
  const handlePrintStandee = (qr: ShopQR) => {
    setPrintableQr(qr);
    document.body.classList.add('printing-standee');

    const cleanup = () => {
      document.body.classList.remove('printing-standee');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // Give DOM a frame to bind
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1200);
    }, 150);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header (Clean: No red blinking dot, No Download QZ button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Hardware Architecture &amp; Entry Routing
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            QR &amp; PC Management
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Every dynamic QR Code links customers directly to this workshop and terminal queue via unique Shop Codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PRIMARY ACTION 1: + ADD / GENERATE QR CODE */}
          <Button
            onClick={handleOpenGenerateQr}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold rounded-lg h-9 px-4 gap-1.5 shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            <span>{"Add / Generate QR Code"}</span>
          </Button>

          {/* PRIMARY ACTION 2: + ADD PC (Only if under 2 PC limit) */}
          {!isLimitReached && (
            <Button
              onClick={() => setAddPcModalOpen(true)}
              variant="outline"
              className="text-xs font-sans font-semibold rounded-lg h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Add PC</span>
            </Button>
          )}

          {/* PRIMARY ACTION 3: SEND REQUEST FOR MORE PCS (Item 5) */}
          <Button
            onClick={() => setRequestPcModalOpen(true)}
            variant="outline"
            className="text-xs font-sans font-semibold rounded-lg h-9 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            title="Request additional PC terminals from Super Admin"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Request for More PCs</span>
          </Button>
        </div>
      </div>
      {/* ---------------- SECTION 1: DYNAMIC DATABASE QR CODES ---------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-heading font-bold uppercase text-foreground">
              Dynamic Shop &amp; Counter QR Codes
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadQrs}
            disabled={loadingQrs}
            className="h-8 text-xs font-sans font-semibold rounded-lg gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQrs ? 'animate-spin' : ''}`} />
            <span>Sync QRs</span>
          </Button>
        </div>

        {loadingQrs && qrs.length === 0 ? (
          <div className="p-10 text-center bg-card border border-border rounded-xl">
            <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs font-mono text-muted-foreground">Loading QR codes...</p>
          </div>
        ) : qrs.length === 0 ? (
          <Card className="bg-card border-border rounded-xl p-10 text-center">
            <QrCode className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-sm font-heading font-bold uppercase text-foreground">
              No QR Codes Generated Yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4 font-sans">
              Click &quot;+ Add / Generate QR Code&quot; to generate your first readable shop code (e.g. HE-344245-001) mapped to your counter queue.
            </p>
            <Button
              onClick={handleOpenGenerateQr}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg h-9 px-5 gap-1.5 shadow-sm"
            >
              <QrCode className="w-4 h-4" />
              <span>Generate First QR Code</span>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrs.map((qr) => {
              const mappedPc = pcs.find((p) => p.id === qr.pc_id);
              const qrScanUrl = getShopQrUrl(qr.shop_code);

              return (
                <Card
                  key={qr.id}
                  className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all flex flex-col justify-between shadow-sm"
                >
                  <div className="p-5 space-y-4">
                    {/* Header: Title & Shop Code */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-heading font-bold text-foreground truncate">
                          {qr.qr_name}
                        </h3>
                        <Badge className="bg-primary/10 text-primary border border-primary/25 font-mono text-[10px] mt-1 font-bold">
                          {qr.shop_code}
                        </Badge>
                      </div>

                      <Badge variant="outline" className="text-[10px] font-mono border-border shrink-0">
                        {mappedPc ? mappedPc.pc_name : 'All PCs'}
                      </Badge>
                    </div>

                    {/* QR Preview & Visual Representation */}
                    <div className="p-4 bg-muted/30 border border-border rounded-xl flex flex-col items-center justify-center gap-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-neutral-200">
                        <QRCodeDataUrl
                          text={qrScanUrl}
                          width={140}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground break-all text-center">
                        {qrScanUrl}
                      </span>
                    </div>

                    {/* Target Route Details */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>Destination Shop:</span>
                        <strong className="text-foreground truncate max-w-[180px] font-mono">
                          {shop?.name || 'printOn24 Workshop'}
                        </strong>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>Assigned Terminal:</span>
                        <strong className="text-foreground font-mono">
                          {mappedPc ? mappedPc.pc_name : 'Shared Counter Queue'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPrintableQr(qr);
                          setStandeeModalOpen(true);
                        }}
                        className="h-8 text-xs font-semibold rounded-lg px-2.5 gap-1"
                      >
                        <Printer className="w-3.5 h-3.5 text-primary" />
                        <span>Standee</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadQrPng(qr)}
                        className="h-8 text-xs font-semibold rounded-lg px-2.5 gap-1"
                        title="Download High-Res PNG"
                      >
                        <Download className="w-3.5 h-3.5 text-primary" />
                        <span>PNG</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(qr.shop_code, qr.id)}
                        className="h-8 text-xs font-semibold rounded-lg px-2.5 gap-1 font-mono"
                        title="Copy Shop Code"
                      >
                        {copiedKey === qr.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{qr.shop_code}</span>
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteQr(qr)}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                      title="Delete QR"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {/* ---------------- SECTION 2: PC MANAGEMENT (STRICT 2/2 TERMINALS) ---------------- */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-heading font-bold uppercase text-foreground">
                Registered Counter PC Workstations
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono border-border">
                {pcs.length} / {effectivePcLimit} Terminals
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              Up to {effectivePcLimit} counter PC terminals supported for dedicated operator dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLimitReached ? (
              <Button
                onClick={() => setAddPcModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg h-8 gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add PC Workstation</span>
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground font-mono">
                Terminal Limit Reached ({effectivePcLimit}/{effectivePcLimit})
              </Badge>
            )}

            <Button
              onClick={() => setRequestPcModalOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs font-semibold rounded-lg h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Send className="w-3 h-3" />
              <span>Send Request for More PCs</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pcs.map((pc) => {
            const isOnline = pc.status === 'online';
            const isEnabled = pc.is_enabled !== false;
            const isCurrentWorkstation = pc.id === selectedPcId || pc.is_current_pc;

            return (
              <Card
                key={pc.id}
                className={`border rounded-xl transition-all overflow-hidden flex flex-col justify-between ${
                  !isEnabled
                    ? 'border-border/60 bg-muted/20 opacity-75'
                    : isCurrentWorkstation
                    ? 'border-primary/60 bg-card shadow-sm ring-1 ring-primary/30'
                    : 'border-border bg-card'
                }`}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-heading font-bold text-foreground truncate">
                          {pc.pc_name}
                        </h3>
                        <p className="text-[11px] font-mono text-muted-foreground">{pc.pc_code}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        className={`text-[10px] font-mono ${
                          isEnabled
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>

                      <Badge
                        className={`text-[10px] font-mono ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1 ${
                            isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'
                          }`}
                        />
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>Role:</span>
                      <strong className="text-foreground font-mono">Counter Printing Terminal</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>Workstation:</span>
                      <strong className="text-primary font-mono">
                        {isCurrentWorkstation ? 'Active Browser Terminal' : 'Secondary Counter'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={isEnabled ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => handleTogglePcEnabled(pc)}
                      className="h-8 text-xs font-semibold rounded-lg px-2.5"
                    >
                      <Power className="w-3.5 h-3.5 mr-1" />
                      {isEnabled ? 'Disable' : 'Enable'}
                    </Button>

                    <Button
                      variant={isCurrentWorkstation ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={!isEnabled}
                      onClick={() => handleSetCurrentPc(pc)}
                      className="h-8 text-xs font-semibold rounded-lg px-3"
                    >
                      {isCurrentWorkstation ? 'Active Terminal' : 'Set as Current PC'}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPcToDelete(pc)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                    title="Delete PC Workstation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Previous PC Terminal Requests (Item 5) */}
        {pcRequests.length > 0 && (
          <div className="mt-4 p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-heading font-bold uppercase text-foreground flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-primary" />
                <span>Super Admin PC Expansion Requests</span>
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono">
                {pcRequests.length} Request(s)
              </Badge>
            </div>
            <div className="divide-y divide-border text-xs">
              {pcRequests.map((req) => (
                <div key={req.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">
                      Requested +{req.requested_count} Additional PC(s)
                    </div>
                    {req.reason && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        Reason: {req.reason}
                      </p>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <Badge
                    className={`text-[10px] font-sans ${
                      req.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : req.status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {req.status === 'approved'
                      ? 'Approved by Super Admin'
                      : req.status === 'rejected'
                      ? 'Declined'
                      : 'Pending Super Admin Review'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* ---------------- SEND REQUEST FOR MORE PCS MODAL (Item 5) ---------------- */}
      <Dialog open={requestPcModalOpen} onOpenChange={setRequestPcModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-xl font-sans bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              <span>Send Request for More PCs</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit a formal expansion request to Super Admin for additional counter PC terminal licenses.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestMorePcs} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Number of Additional PC Terminals Needed
              </Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={requestedPcCount}
                onChange={(e) => setRequestedPcCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-9 text-xs rounded-lg bg-card"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Currently registered: {pcs.length} / {effectivePcLimit} Terminals.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Business Reason / Justification
              </Label>
              <Textarea
                rows={3}
                value={pcRequestReason}
                onChange={(e) => setPcRequestReason(e.target.value)}
                placeholder="e.g. High customer volume during peak morning hours requiring an additional dedicated operator counter."
                className="text-xs rounded-lg bg-card resize-none"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestPcModalOpen(false)}
                className="text-xs font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingPcRequest}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg shadow-sm gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submittingPcRequest ? 'Submitting Request...' : 'Submit Request to Super Admin'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* ---------------- + ADD / GENERATE DYNAMIC QR MODAL ---------------- */}
      <Dialog open={generateQrModalOpen} onOpenChange={setGenerateQrModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <span>+ Add / Generate Dynamic Shop QR</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generates a QR that opens this shop&apos;s upload flow: https://printon24.in/shop/HE-344245-001.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Standee / QR Description</Label>
              <Input
                value={qrName}
                onChange={(e) => setQrName(e.target.value)}
                placeholder="e.g. Counter Front Standee"
                className="h-9 text-xs rounded-lg bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Shop Code (Format: HE-344245-001)
              </Label>
              <Input
                value={customShopCode}
                onChange={(e) => setCustomShopCode(e.target.value.toUpperCase())}
                placeholder="e.g. HE-344245-001"
                className="h-9 text-xs font-mono font-bold uppercase rounded-lg bg-card"
              />
              <p className="text-[10px] text-muted-foreground font-mono">
                Scan URL: {getShopQrUrl(customShopCode || 'HE-344245-001')}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Route to Workstation PC</Label>
              <select
                value={targetPcId}
                onChange={(e) => setTargetPcId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-card text-foreground font-mono text-xs"
              >
                <option value="">All Counter Workstations (Shared Queue)</option>
                {pcs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pc_name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Live QR Preview */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col items-center justify-center gap-2">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <QRCodeDataUrl
                  text={getShopQrUrl(customShopCode || 'HE-344245-001')}
                  width={130}
                />
              </div>
              <p className="text-[11px] font-mono text-primary font-bold">
                {customShopCode || 'HE-344245-001'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setGenerateQrModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGeneratedQr}
              disabled={generatingQr}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-4"
            >
              {generatingQr ? 'Saving to Database...' : 'Save & Issue QR Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ---------------- + ADD PC MODAL (MAX 2) ---------------- */}
      <Dialog open={addPcModalOpen} onOpenChange={setAddPcModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              <span>Register PC Terminal (Max 2)</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddPC} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">PC / Terminal Name</Label>
              <Input
                value={newPcName}
                onChange={(e) => setNewPcName(e.target.value)}
                placeholder="e.g. Counter PC-2"
                className="h-9 text-xs rounded-lg bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Terminal IP (Optional)</Label>
              <Input
                value={newPcIp}
                onChange={(e) => setNewPcIp(e.target.value)}
                placeholder="e.g. 192.168.1.102"
                className="h-9 text-xs font-mono rounded-lg bg-card"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddPcModalOpen(false)}
                className="text-xs font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingPc}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg"
              >
                {savingPc ? 'Registering...' : 'Register PC'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* ---------------- PRINT COUNTER STANDEE MODAL ---------------- */}
      <Dialog open={standeeModalOpen} onOpenChange={setStandeeModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl font-sans p-4 sm:p-6 bg-card border-border">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <span>Counter Standee Placard (A4 Format)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official PrintOn24 Workshop Standee with scannable QR and direct shop routing.
            </DialogDescription>
          </DialogHeader>

          {printableQr && (
            <div className="py-2">
              <StandeePoster
                shop={shop}
                shopCode={printableQr.shop_code}
                qrScanUrl={getShopQrUrl(printableQr.shop_code)}
                compact={true}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap sm:flex-nowrap justify-between pt-3 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStandeeModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              {printableQr && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadQrPng(printableQr)}
                  className="text-xs font-semibold rounded-lg gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span>Download PNG</span>
                </Button>
              )}
              {printableQr && (
                <Button
                  onClick={() => handlePrintStandee(printableQr)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-4 gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Clean A4 Standee</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- 6.2 DEDICATED CLEAN A4 STANDEE PRINT CONTAINER ---------------- */}
      {printableQr && (
        <div
          id="printable-standee-root"
          className="hidden print:flex flex-col items-center justify-between bg-white text-neutral-900"
        >
          <StandeePoster
            shop={shop}
            shopCode={printableQr.shop_code}
            qrScanUrl={getShopQrUrl(printableQr.shop_code)}
            compact={false}
          />
        </div>
      )}
      {/* ---------------- DELETE PC CONFIRMATION MODAL ---------------- */}
      <Dialog open={!!pcToDelete} onOpenChange={(open) => !open && setPcToDelete(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              <span>Delete PC Workstation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to delete PC workstation <strong className="text-foreground">{pcToDelete?.pc_name}</strong> ({pcToDelete?.pc_code})?
              This will unbind assigned printers and release this terminal slot. Historical orders and audit logs remain preserved.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPcToDelete(null)}
              disabled={deletingPc}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeletePc}
              disabled={deletingPc}
              className="text-xs font-semibold rounded-lg gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deletingPc ? 'Deleting...' : 'Confirm Delete'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QrPcManagementPage;
