import {
  Check,
  Monitor,
  Plus,
  Power,
  Printer,
  RotateCw,
  Sliders,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageLockOverlay } from '@/components/PageLockOverlay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { type DetectedPrinter, localPrintAgent } from '@/services/localPrintAgent';
import { isPhysicalPrinter, qzTrayService } from '@/services/qzTrayService';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { ShopPrinter } from '@/types/shopkeeper';

const PRINTER_PAPER_SIZES = ['A4', 'A3', 'Letter', 'Ledger', 'Legal'];
const PRINTER_PAPER_TYPES = ['Standard 75 GSM', 'Bond Paper', 'Glossy', 'Envelope', 'Executive'];

interface MultiOptionDropdownProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}

const MultiOptionDropdown: React.FC<MultiOptionDropdownProps> = ({
  label,
  options,
  value,
  onChange,
}) => (
  <details className="group relative">
    <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
      <span className="truncate">
        {value.length > 0 ? value.join(', ') : `Select ${label.toLowerCase()}`}
      </span>
      <span className="ml-2 text-muted-foreground">v</span>
    </summary>
    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, option]
                  : value.filter((selected) => selected !== option)
              )
            }
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  </details>
);

export const PrintersPage: React.FC = () => {
  const { user, pcs, selectedPcId, setSelectedPcId, realPrinters, refreshPrinters } =
    useShopkeeper();

  const [scanning, setScanning] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState<DetectedPrinter[]>([]);
  const [detectionMessage, setDetectionMessage] = useState('');

  // ADD PRINTER MODAL
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedDetectedPrinterHwId, setSelectedDetectedPrinterHwId] = useState<string>('');
  const [formPrinterName, setFormPrinterName] = useState<string>('');
  const [formModel, setFormModel] = useState<string>('');
  const [formConnectionType, setFormConnectionType] = useState<
    'usb' | 'wifi' | 'lan' | 'network' | 'windows'
  >('usb');
  const [formColorMode, setFormColorMode] = useState<'bw' | 'color' | 'both'>('both');
  const [formSideMode, setFormSideMode] = useState<'both' | 'single' | 'duplex'>('both');
  const [formPaperSizes, setFormPaperSizes] = useState<string[]>(['A4']);
  const [formPaperTypes, setFormPaperTypes] = useState<string[]>(['Standard 75 GSM']);
  const [formAssignedPcId, setFormAssignedPcId] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'online' | 'offline'>('online');
  const [savingPrinter, setSavingPrinter] = useState<boolean>(false);

  // VIRTUAL PRINTER MODAL
  const [addVirtualModalOpen, setAddVirtualModalOpen] = useState(false);
  const [virtualPrinterType, setVirtualPrinterType] = useState<
    'Microsoft Print to PDF' | 'Normal PDF Printer'
  >('Microsoft Print to PDF');
  const [virtualColorMode, setVirtualColorMode] = useState<'both' | 'color' | 'bw'>('both');
  const [virtualDuplex, setVirtualDuplex] = useState<boolean>(true);
  const [virtualPaperSizes, setVirtualPaperSizes] = useState<string[]>(['A4', 'Legal']);
  const [virtualPaperTypes, setVirtualPaperTypes] = useState<string[]>(['Standard 75 GSM']);
  const [savingVirtual, setSavingVirtual] = useState<boolean>(false);

  // EDIT PRINTER MODAL
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<ShopPrinter | null>(null);
  const [editColorMode, setEditColorMode] = useState<'both' | 'color' | 'bw'>('both');
  const [editSideMode, setEditSideMode] = useState<'both' | 'single' | 'duplex'>('both');
  const [editPaperSizes, setEditPaperSizes] = useState<string[]>(['A4']);
  const [editPaperTypes, setEditPaperTypes] = useState<string[]>(['Standard 75 GSM']);

  const activePc = pcs.find((p) => p.id === selectedPcId) || pcs[0];

  // Print Configuration Page Lock state (Item 11)
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    if (!user?.shop_id) return;
    const checkLock = async () => {
      const configured = await shopkeeperApi.isPrintersPasswordConfigured(user.shop_id);
      setIsLocked(configured);
    };
    checkLock();
  }, [user?.shop_id]);

  useEffect(() => {
    if (user?.shop_id) {
      localPrintAgent.setShopCredentials(user.shop_id);
    }
  }, [user?.shop_id]);

  // Fetch installed OS printer drivers for the Add Printer selector.
  const loadDetectedPrintersFromAgent = async () => {
    setScanning(true);
    try {
      const list = await localPrintAgent.getConnectedPrinters(true);
      setDetectedPrinters(list);
      if (
        selectedDetectedPrinterHwId &&
        !list.some((printer) => (printer.hardware_id || printer.id) === selectedDetectedPrinterHwId)
      ) {
        setSelectedDetectedPrinterHwId('');
        setFormPrinterName('');
        setFormModel('');
      }
      if (list.length > 0) {
        setDetectionMessage('');
      } else {
        const status = qzTrayService.getStatus();
        const message = status.connected
          ? status.error || 'QZ Tray is connected, but no printer drivers were found in Windows.'
          : status.error || 'QZ Tray is not connected. Start QZ Tray on this computer and sign in again.';
        setDetectionMessage(message);
        toast.warning(message);
      }
      return list;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not scan printers through QZ Tray.';
      setDetectionMessage(message);
      toast.error(message);
      return [];
    } finally {
      setScanning(false);
    }
  };

  // Open + Add Printer Modal
  const handleOpenAddPrinterModal = async () => {
    setFormAssignedPcId(activePc?.id || pcs[0]?.id || 'pc_01');
    setSelectedDetectedPrinterHwId('');
    setFormPrinterName('');
    setFormModel('');
    setFormConnectionType('usb');
    setFormColorMode('both');
    setFormSideMode('both');
    setFormPaperSizes(['A4']);
    setFormPaperTypes(['Standard 75 GSM']);
    setAddModalOpen(true);
    await loadDetectedPrintersFromAgent();
  };

  // Connection type can be adjusted without changing the selected printer.
  const handleConnectionTypeChange = (newType: 'network' | 'usb' | 'wifi' | 'lan' | 'windows') => {
    setFormConnectionType(newType);
  };

  // When user selects a detected printer from dropdown
  const handleSelectDetectedPrinter = (hwId: string) => {
    setSelectedDetectedPrinterHwId(hwId);
    const found = detectedPrinters.find((d) => (d.hardware_id || d.id) === hwId);
    if (found) {
      setFormPrinterName(found.name);
      setFormModel(found.model || found.name);
      const connectionType = found.connection_type.toLowerCase();
      setFormConnectionType(
        connectionType.includes('usb')
          ? 'usb'
          : connectionType.includes('wifi') || connectionType.includes('wi-fi')
          ? 'wifi'
          : connectionType.includes('lan')
          ? 'lan'
          : connectionType.includes('spooler') || connectionType.includes('windows')
          ? 'windows'
          : 'network'
      );
      setFormColorMode(found.is_color ? 'color' : 'bw');
      setFormSideMode(found.is_duplex ? 'both' : 'single');
      setFormPaperSizes(found.paper_sizes?.length ? found.paper_sizes : ['A4']);
      setFormPaperTypes(found.paper_types?.length ? found.paper_types : ['Standard 75 GSM']);
    } else {
      setFormPrinterName('');
      setFormModel('');
    }
  };

  // Save new printer to real database
  const handleSaveNewPrinter = async () => {
    if (!user?.shop_id) {
      toast.error('Shop session expired');
      return;
    }
    if (!selectedDetectedPrinterHwId) {
      toast.error('Select an installed printer from the list first');
      return;
    }
    if (!formPrinterName.trim()) {
      toast.error('Please enter a Printer Name');
      return;
    }

    setSavingPrinter(true);
    try {
      const isColor = formColorMode === 'color' || formColorMode === 'both';
      const isBw = formColorMode === 'bw' || formColorMode === 'both';
      const isDuplex = formSideMode === 'duplex' || formSideMode === 'both';
      const isSingleSide = formSideMode === 'single' || formSideMode === 'both';
      const usageType = formColorMode === 'color' ? 'Color Only' : formColorMode === 'bw' ? 'B&W Only' : 'All';
      const connLabel =
        formConnectionType === 'wifi'
          ? 'Wi-Fi'
          : formConnectionType === 'lan'
          ? 'LAN'
          : formConnectionType === 'network'
          ? 'Network'
          : formConnectionType === 'windows'
          ? 'Windows Spooler'
          : 'USB';

      const newPrinterPayload: Partial<ShopPrinter> = {
        shop_id: user.shop_id,
        pc_id: formAssignedPcId || activePc?.id || 'pc_01',
        hardware_id: selectedDetectedPrinterHwId || `hw_${Date.now()}`,
        name: formPrinterName.trim(),
        model: formModel || formPrinterName,
        connection_type: connLabel,
        status: formStatus,
        is_online: formStatus === 'online',
        is_color: isColor,
        is_duplex: isDuplex,
        usage_type: usageType,
        paper_sizes: formPaperSizes,
        paper_types: formPaperTypes,
        is_default: false,
        capabilities: {
          color: isColor,
          bw: isBw,
          single_side: isSingleSide,
          double_side: isDuplex,
        },
      };

      const result = await shopkeeperApi.addPrinter(newPrinterPayload);
      if (result) {
        toast.success(`Printer "${formPrinterName}" saved to configuration!`);
        await refreshPrinters();
        setAddModalOpen(false);
      } else {
        toast.error('Failed to save printer to database');
      }
    } catch {
      toast.error('Unexpected error adding printer');
    } finally {
      setSavingPrinter(false);
    }
  };

  // Open Edit Printer Modal
  const handleOpenEditModal = (printer: ShopPrinter) => {
    setEditingPrinter({ ...printer });
    const isColor = printer.is_color === true || printer.capabilities?.color === true;
    const isBw = printer.capabilities?.bw !== false && printer.usage_type !== 'Color Only';
    const colorMode = isColor && isBw ? 'both' : isColor ? 'color' : 'bw';
    setEditColorMode(colorMode);

    const isDuplex = printer.is_duplex === true || printer.capabilities?.double_side === true;
    const isSingle = printer.capabilities?.single_side !== false;
    const sideMode = isDuplex && isSingle ? 'both' : isDuplex ? 'duplex' : 'single';
    setEditSideMode(sideMode);

    setEditPaperSizes(
      printer.paper_sizes && printer.paper_sizes.length > 0 ? [...printer.paper_sizes] : ['A4']
    );
    setEditPaperTypes(
      printer.paper_types && printer.paper_types.length > 0
        ? [...printer.paper_types]
        : ['Standard 75 GSM']
    );
    setEditModalOpen(true);
  };

  // Save changes to printer in database
  const handleSaveEditPrinter = async () => {
    if (!editingPrinter) return;
    try {
      const isColor = editColorMode === 'color' || editColorMode === 'both';
      const isBw = editColorMode === 'bw' || editColorMode === 'both';
      const isDuplex = editSideMode === 'duplex' || editSideMode === 'both';
      const isSingle = editSideMode === 'single' || editSideMode === 'both';
      const usageType = editColorMode === 'color' ? 'Color Only' : editColorMode === 'bw' ? 'B&W Only' : 'All';

      const success = await shopkeeperApi.updatePrinterConfig(editingPrinter.id, {
        name: editingPrinter.name,
        model: editingPrinter.model,
        connection_type: editingPrinter.connection_type,
        pc_id: editingPrinter.pc_id,
        is_color: isColor,
        is_duplex: isDuplex,
        usage_type: usageType,
        paper_sizes: editPaperSizes,
        paper_types: editPaperTypes,
        capabilities: {
          color: isColor,
          bw: isBw,
          single_side: isSingle,
          double_side: isDuplex,
        },
        is_default: editingPrinter.is_default,
      });

      if (success) {
        toast.success(`Configuration updated for "${editingPrinter.name}"`);
        await refreshPrinters();
        setEditModalOpen(false);
      } else {
        toast.error('Failed to update printer configuration.');
      }
    } catch {
      toast.error('Error updating printer');
    }
  };

  // Toggle online/offline status in database
  const handleToggleStatus = async (printer: ShopPrinter) => {
    const nextStatus = printer.status === 'online' ? 'offline' : 'online';
    const success = await shopkeeperApi.updatePrinterConfig(printer.id, {
      status: nextStatus,
      is_online: nextStatus === 'online',
    });
    if (success) {
      toast.success(`Printer marked ${nextStatus}`);
      await refreshPrinters();
    }
  };

  // Delete printer from database
  const handleDeletePrinter = async (printerId: string, printerName: string) => {
    if (!confirm(`Are you sure you want to remove "${printerName}" from your database?`)) return;
    const success = await shopkeeperApi.deletePrinter(printerId);
    if (success) {
      toast.success(`Printer "${printerName}" removed.`);
      await refreshPrinters();
    }
  };

  // Reassign Printer to a specific Counter PC directly from card
  const handleReassignPc = async (printerId: string, newPcId: string) => {
    const targetPc = pcs.find((p) => p.id === newPcId);
    const pcLabel = targetPc ? targetPc.pc_name : 'No Counter (Unassigned)';
    try {
      const ok = await shopkeeperApi.updatePrinterConfig(printerId, {
        pc_id: newPcId || undefined,
      });
      if (ok) {
        toast.success(`Assigned to ${pcLabel}`);
        await refreshPrinters();
      } else {
        toast.error('Failed to update Counter PC in database');
      }
    } catch {
      toast.error('Error assigning printer to Counter PC');
    }
  };

  // Test Print directly to hardware
  const handleTestPrint = async (printer: ShopPrinter) => {
    // Ensure the test page prints on the selected physical printer, not another printer or a virtual printer
    const isVirtual = !isPhysicalPrinter(printer.name) || printer.name.toLowerCase().includes('pdf') || printer.name.toLowerCase().includes('xps') || printer.name.toLowerCase().includes('onenote');
    if (isVirtual) {
      toast.error(`"${printer.name}" is a virtual printer. Please select a physical hardware printer to print the test page.`);
      return;
    }

    toast.info(`Sending test page directly to [${printer.name}]...`);
    try {
      const res = await qzTrayService.testPrint(printer.name);
      if (res.success) {
        toast.success(`Test page printed successfully on ${printer.name}`);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Test print failed on physical printer.');
    }
  };

  // Show only configured printers assigned to the selected counter PC.
  const displayedPrinters = useMemo(() => {
    if (!selectedPcId || selectedPcId === 'all') return realPrinters;
    return realPrinters.filter((p) => !p.pc_id || p.pc_id === selectedPcId);
  }, [realPrinters, selectedPcId]);

  const availableDetectedPrinters = useMemo(
    () =>
      detectedPrinters.filter(
        (detected) =>
          !realPrinters.some(
            (configured) =>
              (detected.hardware_id && configured.hardware_id === detected.hardware_id) ||
              configured.name.trim().toLowerCase() === detected.name.trim().toLowerCase()
          )
      ),
    [detectedPrinters, realPrinters]
  );

  // Manually Add Virtual Printer (Microsoft Print to PDF or Normal PDF Printer)
  const handleAddVirtualPrinter = async () => {
    if (!user?.shop_id) {
      toast.error('Shop identifier missing');
      return;
    }

    setSavingVirtual(true);
    try {
      const isColor = virtualColorMode === 'color' || virtualColorMode === 'both';
      const isBw = virtualColorMode === 'bw' || virtualColorMode === 'both';
      const newPrinterPayload: Partial<ShopPrinter> = {
        shop_id: user.shop_id,
        pc_id: selectedPcId && selectedPcId !== 'all' ? selectedPcId : activePc?.id || 'pc_01',
        hardware_id: `virt_${Date.now()}`,
        name: virtualPrinterType,
        model: virtualPrinterType,
        connection_type: 'network',
        status: 'online',
        is_online: true,
        is_color: isColor,
        is_duplex: virtualDuplex,
        paper_sizes: virtualPaperSizes,
        paper_types: virtualPaperTypes,
        is_default: false,
        usage_type:
          virtualColorMode === 'color' ? 'Color Only' : virtualColorMode === 'bw' ? 'B&W Only' : 'All',
        capabilities: {
          color: isColor,
          bw: isBw,
          single_side: true,
          double_side: virtualDuplex,
        },
      };

      const result = await shopkeeperApi.addPrinter(newPrinterPayload);
      if (result) {
        toast.success(`Virtual printer "${virtualPrinterType}" successfully added to configuration!`);
        await refreshPrinters();
        setAddVirtualModalOpen(false);
      } else {
        toast.error('Failed to add virtual printer to configuration.');
      }
    } catch {
      toast.error('Error adding virtual printer.');
    } finally {
      setSavingVirtual(false);
    }
  };

  return (
    <PageLockOverlay
      isLocked={isLocked}
      title="Print Configuration"
      description="Hardware routing and printer driver settings are protected by an administrative passcode."
      unlockButtonText="Unlock Your Print Configuration"
      onVerifyPassword={async (pwd) => {
        if (!user?.shop_id) return false;
        return await shopkeeperApi.verifyPrintersPassword(user.shop_id, pwd);
      }}
      onUnlockSuccess={() => setIsLocked(false)}
    >
      <div className="space-y-6 font-sans">
      {/* Header Banner (Clean: No "Hardware Layer", No red dot, No "Go For Print") */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Printer Configuration
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Manage printer drivers explicitly added to workshop counter workstations for direct queue output.
          </p>
        </div>

        {/* PRIMARY ACTIONS & WORKSTATION FILTER */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Workstation filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 border border-border rounded-lg text-xs font-mono">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <select
              value={selectedPcId}
              onChange={(e) => setSelectedPcId(e.target.value)}
              className="bg-transparent border-none text-foreground font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Counter PCs</option>
              {pcs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pc_name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await loadDetectedPrintersFromAgent();
              await refreshPrinters();
              toast.success('Printer status synced');
            }}
            className="h-9 text-xs font-semibold rounded-lg gap-1.5"
            disabled={scanning}
          >
            <RotateCw className={`w-3.5 h-3.5 text-primary ${scanning ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {/* PRIMARY + ADD PRINTER ACTION */}
          <Button
            onClick={handleOpenAddPrinterModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold rounded-lg h-9 px-4 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{"Add Printer"}</span>
          </Button>

          {/* ADD VIRTUAL PRINTER ACTION */}
          <Button
            variant="outline"
            onClick={() => setAddVirtualModalOpen(true)}
            className="h-9 text-xs font-heading font-bold rounded-lg border-dashed border-primary/40 hover:border-primary gap-1.5"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>{"Add Virtual Printer"}</span>
          </Button>
        </div>
      </div>
      {/* PRINTERS LIST */}
      {displayedPrinters.length === 0 ? (
        <Card className="bg-card border-border rounded-xl p-12 text-center shadow-sm">
          <Printer className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-bold uppercase text-foreground">
            No Printers Configured Yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-5 font-sans">
            Select an installed printer driver from &quot;+ Add Printer&quot; to add it to this configuration.
          </p>
          <Button
            onClick={handleOpenAddPrinterModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg h-9 px-5 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{"Add Printer Now"}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPrinters.map((printer) => {
            const isOnline = printer.status === 'online';

            return (
              <Card
                key={printer.id}
                className={`border rounded-xl transition-all overflow-hidden flex flex-col justify-between ${
                  isOnline
                    ? 'bg-card border-border hover:border-primary/50 shadow-sm'
                    : 'bg-muted/20 border-border opacity-75'
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Top Header: Name, Status & Connection Type */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isOnline
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <Printer className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-heading font-bold text-foreground truncate" title={printer.name}>
                          {printer.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">
                          {printer.model || printer.name}
                        </p>
                      </div>
                    </div>

                    <Badge
                      className={`text-[10px] font-mono shrink-0 ${
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

                  {/* Capabilities Badges */}
                  <div className="space-y-2 text-xs font-sans">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          printer.is_color
                            ? 'border-primary/40 text-primary bg-primary/5'
                            : 'border-border text-foreground'
                        }`}
                      >
                        {printer.is_color ? 'Color & B&W' : 'Monochrome (B&W)'}
                      </Badge>

                      <Badge variant="outline" className="text-[10px] font-mono border-border text-foreground">
                        {printer.is_duplex ? 'Duplex (Double Side)' : 'Single Side Only'}
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          printer.connection_type?.toLowerCase().includes('wifi') ||
                          printer.connection_type?.toLowerCase().includes('wi-fi')
                            ? 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10'
                            : printer.connection_type?.toLowerCase().includes('lan') ||
                              printer.connection_type?.toLowerCase().includes('network')
                            ? 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10'
                            : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {printer.connection_type.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Paper Sizes */}
                    <div className="pt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>Paper Sizes:</span>
                      <strong className="text-foreground font-mono">
                        {printer.paper_sizes?.join(', ') || 'A4'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Paper Types:</span>
                      <strong className="text-foreground font-mono text-right">
                        {printer.paper_types?.join(', ') || 'Standard 75 GSM'}
                      </strong>
                    </div>

                    {/* ASSIGN TO COUNTER PC DROPDOWN */}
                    <div className="pt-2 border-t border-border/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5 text-primary" />
                          Assign to Counter PC:
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {pcs.find((p) => p.id === printer.pc_id)?.pc_name || 'Counter PC-1'}
                        </span>
                      </div>
                      <select
                        value={printer.pc_id || ''}
                        onChange={(e) => handleReassignPc(printer.id, e.target.value)}
                        className="w-full text-xs font-mono bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Counter PC-1 (Default Counter)</option>
                        {pcs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.pc_name} ({p.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {/* Test Print button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestPrint(printer)}
                      className="h-8 text-xs font-semibold rounded-lg px-2.5 gap-1"
                      title="Send physical test page"
                    >
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span>Test Print</span>
                    </Button>

                    {/* Config / Edit */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(printer)}
                      className="h-8 text-xs font-semibold rounded-lg px-2.5 gap-1"
                      title="Edit Printer Settings"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Configure</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Power Toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStatus(printer)}
                      className={`h-8 w-8 rounded-lg ${isOnline ? 'text-emerald-500' : 'text-muted-foreground'}`}
                      title={isOnline ? 'Disable Printer' : 'Enable Printer'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePrinter(printer.id, printer.name)}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                      title="Remove Printer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {/* ---------------- + ADD PRINTER MODAL ---------------- */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <span>Add Installed Printer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a printer driver installed on this workstation. It will be added to your configuration after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Installed printer drivers dropdown */}
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Available Printers ({availableDetectedPrinters.length})
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadDetectedPrintersFromAgent}
                  disabled={scanning}
                  className="h-6 text-[11px] gap-1 px-1.5"
                >
                  <RotateCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                  <span>Rescan</span>
                </Button>
              </div>

              {availableDetectedPrinters.length > 0 ? (
                <select
                  value={selectedDetectedPrinterHwId}
                  onChange={(e) => handleSelectDetectedPrinter(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a printer driver</option>
                  {availableDetectedPrinters.map((p) => (
                    <option key={p.hardware_id || p.id} value={p.hardware_id || p.id}>
                      {p.name} [{p.connection_type}] {p.is_color ? '(Color)' : '(B&W)'}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-muted-foreground font-sans">
                  {detectionMessage ||
                    (detectedPrinters.length > 0
                      ? 'All installed printers are already added to this configuration.'
                      : 'No printer drivers detected. Start QZ Tray on this computer, then select Rescan.')}
                </p>
              )}
            </div>

            {selectedDetectedPrinterHwId && (
              <>
            {/* Manual details form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Printer Name</Label>
                <Input
                  value={formPrinterName}
                  onChange={(e) => setFormPrinterName(e.target.value)}
                  placeholder="e.g. HP LaserJet Pro M404dn"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Model / Series</Label>
                <Input
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="e.g. M404dn"
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Connection Type & Assigned Counter PC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Connection Interface</Label>
                <select
                  value={formConnectionType}
                  onChange={(e) =>
                    handleConnectionTypeChange(
                      e.target.value as 'network' | 'usb' | 'wifi' | 'lan' | 'windows'
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="wifi">Wi-Fi / Wireless Network</option>
                  <option value="lan">LAN / Ethernet Cable</option>
                  <option value="usb">USB Direct Cable</option>
                  <option value="network">Network Printer</option>
                  <option value="windows">Windows Spooler</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Assign to Counter PC</Label>
                <select
                  value={formAssignedPcId}
                  onChange={(e) => setFormAssignedPcId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  {pcs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pc_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Capabilities */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Color Capability</Label>
                <select
                  value={formColorMode}
                  onChange={(e: any) => setFormColorMode(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
                >
                  <option value="both">Color &amp; Black/White</option>
                  <option value="bw">Black &amp; White Only</option>
                  <option value="color">Full Color Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Side Printing Support</Label>
                <select
                  value={formSideMode}
                  onChange={(e) => setFormSideMode(e.target.value as 'both' | 'single' | 'duplex')}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
                >
                  <option value="both">Single Side &amp; Back-to-Back</option>
                  <option value="single">Single Side Only</option>
                  <option value="duplex">Back-to-Back Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Supported Paper Sizes</Label>
                <MultiOptionDropdown
                  label="paper sizes"
                  options={PRINTER_PAPER_SIZES}
                  value={formPaperSizes}
                  onChange={setFormPaperSizes}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Supported Paper Types</Label>
                <MultiOptionDropdown
                  label="paper types"
                  options={PRINTER_PAPER_TYPES}
                  value={formPaperTypes}
                  onChange={setFormPaperTypes}
                />
              </div>
            </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewPrinter}
              disabled={savingPrinter || !selectedDetectedPrinterHwId}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-4"
            >
              {savingPrinter ? 'Saving...' : 'Save & Register Printer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ---------------- EDIT PRINTER MODAL ---------------- */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground">
              Configure {editingPrinter?.name}
            </DialogTitle>
          </DialogHeader>

          {editingPrinter && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Printer Display Name</Label>
                <Input
                  value={editingPrinter.name}
                  onChange={(e) => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Counter PC Assignment</Label>
                <select
                  value={editingPrinter.pc_id || ''}
                  onChange={(e) => setEditingPrinter({ ...editingPrinter, pc_id: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
                >
                  <option value="">Counter PC-1 (Default Counter)</option>
                  {pcs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pc_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Supported Paper Sizes</Label>
                  <MultiOptionDropdown
                    label="paper sizes"
                    options={PRINTER_PAPER_SIZES}
                    value={editPaperSizes}
                    onChange={setEditPaperSizes}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Supported Paper Types</Label>
                  <MultiOptionDropdown
                    label="paper types"
                    options={PRINTER_PAPER_TYPES}
                    value={editPaperTypes}
                    onChange={setEditPaperTypes}
                  />
                </div>
              </div>

              {/* Color Support */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Color Support Condition</Label>
                <select
                  value={editColorMode}
                  onChange={(e: any) => setEditColorMode(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
                >
                  <option value="both">Both (Color &amp; Black/White)</option>
                  <option value="bw">Black &amp; White Only</option>
                  <option value="color">Full Color Only</option>
                </select>
              </div>

              {/* Side Printing Support */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Side Printing Support Condition</Label>
                <select
                  value={editSideMode}
                  onChange={(e: any) => setEditSideMode(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
                >
                  <option value="both">Both (Single Side &amp; Back-to-Back)</option>
                  <option value="single">Single Side Only</option>
                  <option value="duplex">Back-to-Back (Duplex) Only</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs font-semibold">Default Counter Printer</Label>
                <Switch
                  checked={editingPrinter.is_default}
                  onCheckedChange={(def) => setEditingPrinter({ ...editingPrinter, is_default: def })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditPrinter}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-4"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ---------------- + ADD VIRTUAL PRINTER MODAL ---------------- */}
      <Dialog open={addVirtualModalOpen} onOpenChange={setAddVirtualModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <span>Add Virtual Printer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Select one of the supported virtual printer options to manually add it to your workshop printer configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs font-sans">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Select Virtual Printer Option</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    name: 'Microsoft Print to PDF' as const,
                    desc: 'Windows default PDF rendering engine',
                  },
                  {
                    name: 'Normal PDF Printer' as const,
                    desc: 'Standard software PDF generation queue',
                  },
                ].map((opt) => {
                  const isSelected = virtualPrinterType === opt.name;
                  return (
                    <div
                      key={opt.name}
                      onClick={() => setVirtualPrinterType(opt.name)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">{opt.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Counter PC assignment */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Assigned Counter PC</Label>
              <select
                value={selectedPcId && selectedPcId !== 'all' ? selectedPcId : activePc?.id || 'pc_01'}
                onChange={(e) => setSelectedPcId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
              >
                {pcs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pc_name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Supported Paper Sizes</Label>
                <MultiOptionDropdown
                  label="paper sizes"
                  options={PRINTER_PAPER_SIZES}
                  value={virtualPaperSizes}
                  onChange={setVirtualPaperSizes}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Supported Paper Types</Label>
                <MultiOptionDropdown
                  label="paper types"
                  options={PRINTER_PAPER_TYPES}
                  value={virtualPaperTypes}
                  onChange={setVirtualPaperTypes}
                />
              </div>
            </div>

            {/* Color Capabilities */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Color Capabilities</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'both' as const, label: 'B&W + Color' },
                  { value: 'color' as const, label: 'Color Only' },
                  { value: 'bw' as const, label: 'B&W Only' },
                ].map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setVirtualColorMode(c.value)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                      virtualColorMode === c.value
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sides / Duplex */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Sides / Duplex Support</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: 'Single + Back-to-Back' },
                  { value: false, label: 'Single Side Only' },
                ].map((s) => (
                  <button
                    key={String(s.value)}
                    type="button"
                    onClick={() => setVirtualDuplex(s.value)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                      virtualDuplex === s.value
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddVirtualModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddVirtualPrinter}
              disabled={savingVirtual}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-4 gap-1.5"
            >
              {savingVirtual ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Add Virtual Printer</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageLockOverlay>
  );
};

export default PrintersPage;
