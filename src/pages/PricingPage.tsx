import {
  Calculator,
  Check,
  Circle,
  Edit3,
  FileText,
  HelpCircle,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { DynamicPaperType, ShopPricing } from '@/types/shopkeeper';
import {
  getBillablePrintUnits,
  getBillablePrintUnitsForDocuments,
  getDocumentPageCounts,
  getShortDocumentRate,
  isPrintModeEligible,
} from '@/utils/printPricing';

const DYNAMIC_PAPER_NAME_OPTIONS = [
  'A4',
  'A3',
  'A5',
  'Letter',
  'Ledger',
  'Legal',
  'Tabloid',
  'Bond Paper',
  'Glossy Photo',
  'Envelope',
  'Executive',
];

const PRINT_MODE_OPTIONS = [
  { key: 'eligible_bw_single', label: 'B&W Single' },
  { key: 'eligible_bw_back_to_back', label: 'B&W Back-to-Back' },
  { key: 'eligible_color_single', label: 'Colour Single' },
  { key: 'eligible_color_back_to_back', label: 'Colour Back-to-Back' },
] as const;

type PrintModeEligibilityKey = (typeof PRINT_MODE_OPTIONS)[number]['key'];

export const PricingPage: React.FC = () => {
  const { user, t } = useShopkeeper();

  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dynamic Paper Types (Item 14)
  const [paperTypes, setPaperTypes] = useState<DynamicPaperType[]>([]);
  const [savingPaper, setSavingPaper] = useState(false);
  const [paperModalOpen, setPaperModalOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<DynamicPaperType | null>(null);
  const [paperName, setPaperName] = useState('');
  const [paperBwPrice, setPaperBwPrice] = useState('2.0');
  const [paperColorPrice, setPaperColorPrice] = useState('10.0');
  const [paperIsSpecial, setPaperIsSpecial] = useState(false);
  const [paperIsActive, setPaperIsActive] = useState(true);

  // Specialized Paper Highlighting (Item 15)
  const [specializedColors, setSpecializedColors] = useState<Record<string, string>>({
    A3: '#fef08a',
    Bond: '#bae6fd',
    Glossy: '#e9d5ff',
    Envelope: '#fed7aa',
  });
  const [savingColors, setSavingColors] = useState(false);

  // Live Cost Simulator state (GSM / Paper Quality removed as requested)
  const [calcPages, setCalcPages] = useState(10);
  const [calcDocumentCount, setCalcDocumentCount] = useState(1);
  const [calcCopies, setCalcCopies] = useState(1);
  const [calcPrintType, setCalcPrintType] = useState<'bw' | 'color'>('bw');
  const [calcSides, setCalcSides] = useState<'single' | 'back_to_back'>('single');
  const [calcPaperSize, setCalcPaperSize] = useState<'a4' | 'a3'>('a4');

  const getSimulatorPaper = (size: 'a4' | 'a3') =>
    paperTypes.find((paper) => paper.name.toLowerCase() === size);

  const isSimulatorOptionEligible = (
    isColor: boolean,
    isDuplex: boolean,
    size: 'a4' | 'a3' = calcPaperSize
  ) => {
    const selectedPaper = getSimulatorPaper(size);
    return !pricing || isPrintModeEligible(pricing, selectedPaper, isColor, isDuplex);
  };

  const canSimulateColorMode = (isColor: boolean, size: 'a4' | 'a3' = calcPaperSize) =>
    isSimulatorOptionEligible(isColor, false, size) || isSimulatorOptionEligible(isColor, true, size);

  useEffect(() => {
    if (!pricing || isSimulatorOptionEligible(calcPrintType === 'color', calcSides === 'back_to_back')) return;

    const options = [
      [calcPrintType === 'color', calcSides !== 'back_to_back'],
      [calcPrintType !== 'color', calcSides === 'back_to_back'],
      [calcPrintType !== 'color', calcSides !== 'back_to_back'],
      [calcPrintType === 'color', calcSides === 'back_to_back'],
    ] as const;

    for (const [isColor, isDuplex] of options) {
      if (isSimulatorOptionEligible(isColor, isDuplex)) {
        setCalcPrintType(isColor ? 'color' : 'bw');
        setCalcSides(isDuplex ? 'back_to_back' : 'single');
        return;
      }
    }
  }, [pricing, paperTypes, calcPrintType, calcSides, calcPaperSize]);

  const fetchPricing = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const [data, dTypes, sColors] = await Promise.all([
        shopkeeperApi.getShopPricing(user.shop_id),
        shopkeeperApi.getDynamicPaperTypes(user.shop_id),
        shopkeeperApi.getSpecializedPaperColors(user.shop_id),
      ]);
      setPricing(data);
      if (dTypes && dTypes.length > 0) setPaperTypes(dTypes);
      if (sColors && Object.keys(sColors).length > 0) setSpecializedColors(sColors);
    } catch {
      toast.error('Failed to load pricing table');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, [user?.shop_id]);

  // Handle Dynamic Paper Type save / add
  const handleOpenAddPaper = () => {
    setEditingPaper(null);
    const availableName = DYNAMIC_PAPER_NAME_OPTIONS.find(
      (name) => !paperTypes.some((paper) => paper.name.toLowerCase() === name.toLowerCase())
    );
    setPaperName(availableName || '');
    setPaperBwPrice('3.0');
    setPaperColorPrice('12.0');
    setPaperIsSpecial(true);
    setPaperIsActive(true);
    setPaperModalOpen(true);
  };

  const handleOpenEditPaper = (pt: DynamicPaperType) => {
    setEditingPaper(pt);
    setPaperName(pt.name);
    setPaperBwPrice(String(pt.bw_price));
    setPaperColorPrice(String(pt.color_price));
    setPaperIsSpecial(Boolean(pt.is_special));
    setPaperIsActive(pt.is_active);
    setPaperModalOpen(true);
  };

  const handleSavePaperType = async () => {
    if (!paperName.trim()) {
      toast.error('Please enter a paper type name');
      return;
    }
    if (!user?.shop_id) return;

    const bwP = Number(paperBwPrice);
    const colP = Number(paperColorPrice);
    if (!Number.isFinite(bwP) || !Number.isFinite(colP) || bwP < 0 || colP < 0) {
      toast.error('Enter valid non-negative prices for both print modes.');
      return;
    }
    const normalizedName = paperName.trim();
    if (paperTypes.some((paper) =>
      paper.id !== editingPaper?.id && paper.name.toLowerCase() === normalizedName.toLowerCase()
    )) {
      toast.error('A paper type with this name already exists.');
      return;
    }

    let updated: DynamicPaperType[];
    if (editingPaper) {
      updated = paperTypes.map((p) =>
        p.id === editingPaper.id
          ? {
              ...p,
              name: normalizedName,
              bw_price: bwP,
              color_price: colP,
              is_special: p.id === 'a4' ? false : paperIsSpecial,
              is_active: p.id === 'a4' ? true : paperIsActive,
            }
          : p
      );
    } else {
      const newId = `pt_${Date.now()}_${normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      updated = [
        ...paperTypes,
        {
          id: newId,
          name: normalizedName,
          bw_price: bwP,
          color_price: colP,
          is_special: paperIsSpecial,
          is_active: paperIsActive,
          eligible_bw_single: true,
          eligible_bw_back_to_back: true,
          eligible_color_single: true,
          eligible_color_back_to_back: true,
        },
      ];
    }

    setSavingPaper(true);
    try {
      await shopkeeperApi.saveDynamicPaperTypes(user.shop_id, updated);
      setPaperTypes(updated);
      setPaperModalOpen(false);
      toast.success(`Paper type "${normalizedName}" saved successfully!`);
    } catch (err) {
      console.error('Failed to save paper type:', err);
      toast.error(`Failed to save paper type: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setSavingPaper(false);
    }
  };

  const handleTogglePaperActive = async (id: string, currentActive: boolean) => {
    if (id === 'a4') {
      toast.error('A4 is the default standard paper and cannot be deactivated.');
      return;
    }
    if (!user?.shop_id) return;

    const updated = paperTypes.map((p) => (p.id === id ? { ...p, is_active: !currentActive } : p));
    setSavingPaper(true);
    try {
      await shopkeeperApi.saveDynamicPaperTypes(user.shop_id, updated);
      setPaperTypes(updated);
      toast.success('Paper availability status updated.');
    } catch (err) {
      console.error('Failed to update paper availability:', err);
      toast.error(`Failed to update paper availability: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setSavingPaper(false);
    }
  };

  const handleTogglePaperEligibility = async (
    paper: DynamicPaperType,
    key: PrintModeEligibilityKey,
    eligible: boolean
  ) => {
    if (!user?.shop_id) return;
    if (!eligible && PRINT_MODE_OPTIONS.every((option) => option.key === key || !paper[option.key])) {
      toast.error('Keep at least one print mode eligible for this paper type.');
      return;
    }

    const updated = paperTypes.map((item) =>
      item.id === paper.id ? { ...item, [key]: eligible } : item
    );
    setSavingPaper(true);
    try {
      await shopkeeperApi.saveDynamicPaperTypes(user.shop_id, updated);
      setPaperTypes(updated);
      toast.success(`Print eligibility for ${paper.name} updated.`);
    } catch (err) {
      console.error('Failed to update paper print eligibility:', err);
      toast.error(`Failed to update print eligibility: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setSavingPaper(false);
    }
  };

  const renderBaseRateEligibility = (key: PrintModeEligibilityKey) => (
    <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
      <span className="text-[10px] font-medium text-muted-foreground">Eligible for customers</span>
      <Switch
        checked={pricing?.[key] ?? true}
        onCheckedChange={(checked) => {
          if (pricing) setPricing({ ...pricing, [key]: checked });
        }}
        aria-label={`Toggle ${PRINT_MODE_OPTIONS.find((option) => option.key === key)?.label} eligibility`}
      />
    </div>
  );

  const handleDeletePaper = async (paper: DynamicPaperType) => {
    if (paper.id === 'a4') {
      toast.error('A4 is the system default paper size and cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete paper type/size "${paper.name}"?`)) return;
    if (!user?.shop_id) return;

    const updated = paperTypes.filter((p) => p.id !== paper.id);
    setSavingPaper(true);
    try {
      await shopkeeperApi.saveDynamicPaperTypes(user.shop_id, updated);
      setPaperTypes(updated);
      toast.success(`Paper size/type "${paper.name}" deleted from database.`);
    } catch (err) {
      console.error('Failed to delete paper type:', err);
      toast.error(`Failed to delete paper type: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setSavingPaper(false);
    }
  };

  // Handle Specialized Paper Highlight Color change
  const handleColorChange = async (paperKey: string, colorHex: string) => {
    if (!user?.shop_id) return;
    const newColors = { ...specializedColors, [paperKey]: colorHex };
    setSpecializedColors(newColors);
    setSavingColors(true);
    try {
      await shopkeeperApi.saveSpecializedPaperColors(user.shop_id, newColors);
      toast.success(`Highlight color for ${paperKey} updated!`);
    } catch {
      toast.error('Failed to save highlight color');
    } finally {
      setSavingColors(false);
    }
  };

  // Working Reset button: resets the pricing matrix form to standard default rates
  const handleReset = () => {
    if (!pricing) return;
    setPricing({
      ...pricing,
      bw_single: 2.0,
      bw_back_to_back: 1.5,
      color_single: 10.0,
      color_back_to_back: 8.0,
      a4_rate: 1.0,
      a3_rate: 5.0,
      bond_paper_rate: 3.0,
      glossy_paper_rate: 15.0,
      urgent_surcharge: 5.0,
      binding_rate: 30.0,
      lamination_rate: 20.0,
    });
    toast.success('Rates reset to standard defaults. Click "Save & Publish" to sync with customer app.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing) return;
    if (!Number.isInteger(pricing.short_page_limit) || pricing.short_page_limit < 0) {
      toast.error('Enter a whole number of pages for the short-document limit.');
      return;
    }
    if (
      !pricing.eligible_bw_single &&
      !pricing.eligible_bw_back_to_back &&
      !pricing.eligible_color_single &&
      !pricing.eligible_color_back_to_back
    ) {
      toast.error('At least one print mode must remain eligible.');
      return;
    }
    if (
      pricing.short_page_limit > 0 &&
      (pricing.bw_short_page_rate < 0.5 || pricing.color_short_page_rate < 0.5)
    ) {
      toast.error('Set both short-document rates to at least ₹0.50 per billable page.');
      return;
    }

    setSaving(true);
    try {
      const success = await shopkeeperApi.updatePricing(pricing);
      if (success) {
        toast.success('Page pricing matrix updated & synced with customer app!');
      } else {
        toast.error('Failed to update pricing');
      }
    } finally {
      setSaving(false);
    }
  };

  // Calculate live simulator estimate without GSM option
  const calculateEstimate = () => {
    if (!pricing) return 0;
    let baseRate = 0;
    if (calcPrintType === 'bw') {
      baseRate = calcSides === 'single' ? pricing.bw_single : pricing.bw_back_to_back;
    } else {
      baseRate = calcSides === 'single' ? pricing.color_single : pricing.color_back_to_back;
    }

    let paperSurcharge = 0;
    if (calcPaperSize === 'a3') {
      paperSurcharge += (pricing.a3_rate || 5) - (pricing.a4_rate || 1);
    }

    const documentPageCounts = getDocumentPageCounts(
      calcPages * calcDocumentCount,
      Array.from({ length: calcDocumentCount }, () => calcPages)
    );
    const shortPageRate = calcPrintType === 'bw' ? pricing.bw_short_page_rate : pricing.color_short_page_rate;
    const mode = calcPrintType === 'bw' ? pricing.bw_pricing_mode : pricing.color_pricing_mode;
    const total = documentPageCounts.reduce((documentTotal, pages) => {
      const documentShortRate = getShortDocumentRate(pages, pricing.short_page_limit, shortPageRate);
      const ratePerPage = Math.max(0.5, (documentShortRate ?? baseRate) + paperSurcharge);
      return (
        documentTotal +
        ratePerPage * getBillablePrintUnits(pages, calcCopies, calcSides === 'back_to_back', mode || 'print')
      );
    }, 0);
    return Math.round(total * 100) / 100;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header (Clean: No red dot, working Reset button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">Commercial Rates</span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            {t('pricing')}
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Configure per-page rates for monochrome, color, duplex, and specialty media types.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Functional Working Reset Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={loading || !pricing}
            className="text-xs font-sans h-9 rounded-lg gap-1.5"
            title="Reset matrix to standard defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>Reset</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !pricing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold font-heading h-9 rounded-lg gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Syncing...' : 'Save & Publish Rates'}</span>
          </Button>
        </div>
      </div>

      {pricing && (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Rate Matrix Configuration Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Base Print Type & Sides Pricing */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  1. Base Per-Page Print Rates (₹)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Core per-page pricing for standard A4 documents.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* B&W Single Side */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground uppercase">
                        B&amp;W Single Side
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Circle className="w-2.5 h-2.5" /> Simplex
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.25"
                        min="0.5"
                        value={pricing.bw_single}
                        onChange={(e) => setPricing({ ...pricing, bw_single: parseFloat(e.target.value) || 0 })}
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Standard monochrome single page</p>
                    {renderBaseRateEligibility('eligible_bw_single')}
                  </div>

                  {/* B&W Back-to-Back */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground uppercase">
                        B&amp;W Back-to-Back
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Circle className="w-2.5 h-2.5" /> Duplex
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.25"
                        min="0.5"
                        value={pricing.bw_back_to_back}
                        onChange={(e) =>
                          setPricing({ ...pricing, bw_back_to_back: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Standard monochrome both sides</p>
                    {renderBaseRateEligibility('eligible_bw_back_to_back')}
                  </div>

                  {/* Color Single Side */}
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-primary uppercase">
                        Colour Single Side
                      </Label>
                      <span className="text-[10px] text-primary font-mono flex items-center gap-1">
                        <Palette className="w-2.5 h-2.5" /> Simplex
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.5"
                        min="1"
                        value={pricing.color_single}
                        onChange={(e) =>
                          setPricing({ ...pricing, color_single: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Full color presentation print</p>
                    {renderBaseRateEligibility('eligible_color_single')}
                  </div>

                  {/* Color Back-to-Back */}
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-primary uppercase">
                        Colour Back-to-Back
                      </Label>
                      <span className="text-[10px] text-primary font-mono flex items-center gap-1">
                        <Palette className="w-2.5 h-2.5" /> Duplex
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.5"
                        min="1"
                        value={pricing.color_back_to_back}
                        onChange={(e) =>
                          setPricing({ ...pricing, color_back_to_back: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Double-sided full color print</p>
                    {renderBaseRateEligibility('eligible_color_back_to_back')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Global print mode eligibility */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  2. Print Mode Eligibility
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Turn off print options your shop does not offer. Paper-specific settings can further restrict these options.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRINT_MODE_OPTIONS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-3 p-3 bg-muted/40 border border-border rounded-lg">
                    <Label htmlFor={`global-${key}`} className="text-xs font-semibold text-foreground">
                      {label}
                    </Label>
                    <Switch
                      id={`global-${key}`}
                      checked={pricing[key]}
                      onCheckedChange={(checked) => setPricing({ ...pricing, [key]: checked })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 3. Printing Price Calculation */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  3. Printing Price Calculation
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Choose how duplex jobs are charged independently for B&amp;W and Colour.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-4">
                {([
                  {
                    key: 'bw_pricing_mode',
                    label: 'Black & White',
                    description: 'Choose one calculation method for B&W orders.',
                  },
                  {
                    key: 'color_pricing_mode',
                    label: 'Colour',
                    description: 'Choose one calculation method for Colour orders.',
                  },
                ] as const).map(({ key, label, description }) => (
                  <div key={key} className="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
                    <div>
                      <Label className="text-xs font-semibold text-foreground uppercase">{label}</Label>
                      <p className="text-[10px] text-muted-foreground">{description}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={pricing[key] === 'page' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPricing({ ...pricing, [key]: 'page' })}
                        className={`h-auto min-h-9 whitespace-normal py-2 text-xs ${
                          pricing[key] === 'page' ? 'bg-primary text-primary-foreground font-semibold' : ''
                        }`}
                      >
                        Price According to Page
                        <span className="block text-[10px] font-normal opacity-80">
                          Duplex charges count physical sheets used.
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant={pricing[key] === 'print' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPricing({ ...pricing, [key]: 'print' })}
                        className={`h-auto min-h-9 whitespace-normal py-2 text-xs ${
                          pricing[key] === 'print' ? 'bg-primary text-primary-foreground font-semibold' : ''
                        }`}
                      >
                        Price According to Print
                        <span className="block text-[10px] font-normal opacity-80">
                          Charges count every document page.
                        </span>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 4. Short-document pricing */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  4. Page Price Limitation
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Set a special per-page rate for short documents. The limit is checked separately for each document; documents above it use regular rates.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="max-w-xs space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground uppercase">
                    Short-document limit (pages)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={pricing.short_page_limit}
                    onChange={(e) =>
                      setPricing({ ...pricing, short_page_limit: Number.parseInt(e.target.value, 10) || 0 })
                    }
                    className="text-sm font-mono font-bold rounded-lg"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use 0 to disable. The special rate applies when an individual document is at or below this page limit.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: 'bw_short_page_rate', label: 'B&W short-document rate' },
                    { key: 'color_short_page_rate', label: 'Colour short-document rate' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground uppercase">{label} (₹/page)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                        <Input
                          type="number"
                          min={pricing.short_page_limit > 0 ? '0.5' : '0'}
                          step="0.25"
                          value={pricing[key]}
                          onChange={(e) =>
                            setPricing({ ...pricing, [key]: Number.parseFloat(e.target.value) || 0 })
                          }
                          className="pl-7 text-sm font-mono font-bold rounded-lg"
                          required={pricing.short_page_limit > 0}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Applies separately to B&amp;W and Colour for each document within the limit.
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 5. Finishing & Add-ons Services */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  5. Post-Processing &amp; Finishing Services
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Spiral binding, lamination, and express handling charges.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Spiral Binding */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">Spiral Binding</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        value={pricing.binding_rate}
                        onChange={(e) =>
                          setPricing({ ...pricing, binding_rate: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Up to 100 sheets standard coil</p>
                  </div>

                  {/* Lamination */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">Thermal Lamination</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        value={pricing.lamination_rate}
                        onChange={(e) =>
                          setPricing({ ...pricing, lamination_rate: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Standard A4 pouch lamination</p>
                  </div>

                  {/* Urgent Surcharge */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">Urgent Priority Jump</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={pricing.urgent_surcharge}
                        onChange={(e) =>
                          setPricing({ ...pricing, urgent_surcharge: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Queue priority surcharge per order</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 6. Dynamic Paper Types & Media Matrix (Item 14) */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>6. Dynamic Paper Types &amp; Sizes</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground font-sans">
                    Configure custom paper sizes (A4, A3, A5, Bond, Glossy, Envelope, Jumbo) with individual B&amp;W and Color pricing.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenAddPaper}
                  className="h-9 shrink-0 gap-1.5 self-start rounded-lg bg-primary text-xs font-semibold text-primary-foreground sm:ml-4 sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Paper Type</span>
                </Button>
              </CardHeader>

              <CardContent className="space-y-3 p-4">
                {paperTypes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No paper types configured</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a paper size or media type to configure its rates and print options.
                    </p>
                  </div>
                ) : (
                  paperTypes.map((pt) => (
                    <section key={pt.id} className="overflow-hidden rounded-xl border border-border bg-card">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{pt.name}</h3>
                          {pt.id === 'a4' && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[9px]">Default</Badge>
                          )}
                          {pt.is_special ? (
                            <Badge className="border-primary/30 bg-primary/10 text-primary text-[10px]">
                              Special Paper
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Normal Paper
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {pt.id === 'a4' ? (
                            <span className="mr-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Always Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTogglePaperActive(pt.id, pt.is_active)}
                              disabled={savingPaper}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                                pt.is_active
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'border-border bg-muted text-muted-foreground'
                              }`}
                            >
                              {pt.is_active ? 'Active' : 'Deactivated'}
                            </button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditPaper(pt)}
                            disabled={savingPaper}
                            className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                            title="Edit paper type"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {pt.id !== 'a4' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePaper(pt)}
                              disabled={savingPaper}
                              className="h-8 w-8 rounded-lg p-0 text-red-500/70 hover:bg-red-500/10 hover:text-red-500"
                              title="Delete paper type"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">B&amp;W rate</p>
                          <p className="mt-1 font-mono text-sm font-bold text-foreground">₹{Number(pt.bw_price).toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Colour rate</p>
                          <p className="mt-1 font-mono text-sm font-bold text-primary">₹{Number(pt.color_price).toFixed(2)}</p>
                        </div>
                        {PRINT_MODE_OPTIONS.map(({ key, label }) => (
                          <label
                            key={key}
                            className={`flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-medium ${
                              !pt.is_active ? 'opacity-50' : 'text-foreground'
                            }`}
                          >
                            <span>{label}</span>
                            <Switch
                              className="h-[18px] w-8 shrink-0 [&>span]:h-3.5 [&>span]:w-3.5 data-[state=checked]:[&>span]:translate-x-3"
                              checked={pt[key] !== false}
                              onCheckedChange={(checked) => handleTogglePaperEligibility(pt, key, checked)}
                              disabled={savingPaper || !pt.is_active}
                              aria-label={`${label} eligibility for ${pt.name}`}
                            />
                          </label>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Rate Simulator & Specialized Paper Highlighting */}
          <div className="space-y-6">
            {/* Live Rate Simulator */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span>Live Rate Simulator</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Simulates the selected B&amp;W or Colour calculation method.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs font-sans">
                {/* Total Pages */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label className="text-xs font-semibold uppercase">Document Pages:</Label>
                    <strong className="text-foreground font-mono">{calcPages} pages</strong>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={calcPages}
                    onChange={(e) => setCalcPages(parseInt(e.target.value) || 1)}
                    className="h-9 text-xs font-mono rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label className="text-xs font-semibold uppercase">Number of Documents:</Label>
                    <strong className="text-foreground font-mono">{calcDocumentCount}</strong>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={calcDocumentCount}
                    onChange={(e) => setCalcDocumentCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                    className="h-9 text-xs font-mono rounded-lg"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The page limit is evaluated for each document separately.
                  </p>
                </div>

                {/* Copies */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label className="text-xs font-semibold uppercase">Set Copies:</Label>
                    <strong className="text-foreground font-mono">{calcCopies} copy</strong>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={calcCopies}
                    onChange={(e) => setCalcCopies(parseInt(e.target.value) || 1)}
                    className="h-9 text-xs font-mono rounded-lg"
                  />
                </div>

                {/* Print Type */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase">Color Mode:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={calcPrintType === 'bw' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setCalcPrintType('bw');
                        if (!isSimulatorOptionEligible(false, calcSides === 'back_to_back')) {
                          setCalcSides(
                            isSimulatorOptionEligible(false, false) ? 'single' : 'back_to_back'
                          );
                        }
                      }}
                      disabled={!canSimulateColorMode(false)}
                      className={`h-8 text-xs rounded-lg gap-1.5 ${calcPrintType === 'bw' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      <Circle className="w-3 h-3" />
                      <span>Black &amp; White</span>
                    </Button>
                    <Button
                      type="button"
                      variant={calcPrintType === 'color' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setCalcPrintType('color');
                        if (!isSimulatorOptionEligible(true, calcSides === 'back_to_back')) {
                          setCalcSides(
                            isSimulatorOptionEligible(true, false) ? 'single' : 'back_to_back'
                          );
                        }
                      }}
                      disabled={!canSimulateColorMode(true)}
                      className={`h-8 text-xs rounded-lg gap-1.5 ${calcPrintType === 'color' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      <Palette className="w-3 h-3" />
                      <span>Colour</span>
                    </Button>
                  </div>
                </div>

                {/* Sides */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase">Print Sides:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={calcSides === 'single' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcSides('single')}
                      disabled={!isSimulatorOptionEligible(calcPrintType === 'color', false)}
                      className={`h-8 text-xs rounded-lg ${calcSides === 'single' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      Single Side
                    </Button>
                    <Button
                      type="button"
                      variant={calcSides === 'back_to_back' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcSides('back_to_back')}
                      disabled={!isSimulatorOptionEligible(calcPrintType === 'color', true)}
                      className={`h-8 text-xs rounded-lg ${calcSides === 'back_to_back' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      Back-to-Back
                    </Button>
                  </div>
                </div>

                {/* Paper Size */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase">Paper Size:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={calcPaperSize === 'a4' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcPaperSize('a4')}
                      disabled={!canSimulateColorMode(calcPrintType === 'color', 'a4')}
                      className={`h-8 text-xs rounded-lg ${calcPaperSize === 'a4' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      A4 Standard
                    </Button>
                    <Button
                      type="button"
                      variant={calcPaperSize === 'a3' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcPaperSize('a3')}
                      disabled={!canSimulateColorMode(calcPrintType === 'color', 'a3')}
                      className={`h-8 text-xs rounded-lg ${calcPaperSize === 'a3' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      A3 Large
                    </Button>
                  </div>
                </div>

                {/* Calculated Result Box */}
                <div className="p-4 bg-muted/50 border border-border rounded-xl text-center space-y-1 pt-4 mt-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest block font-mono">
                    Estimated User App Total
                  </span>
                  <div className="text-3xl font-heading font-black text-primary">
                    ₹{calculateEstimate()}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-sans">
                    {getBillablePrintUnitsForDocuments(
                      getDocumentPageCounts(
                        calcPages * calcDocumentCount,
                        Array.from({ length: calcDocumentCount }, () => calcPages)
                      ),
                      calcCopies,
                      calcSides === 'back_to_back',
                      (calcPrintType === 'bw' ? pricing.bw_pricing_mode : pricing.color_pricing_mode) || 'print'
                    )}{' '}
                    billable {calcSides === 'back_to_back' &&
                    (calcPrintType === 'bw' ? pricing.bw_pricing_mode : pricing.color_pricing_mode) === 'page'
                      ? 'sheets'
                      : 'pages'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Specialized Paper Highlighting Card (Item 15 Requirement) */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Specialized Paper Highlighting</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Orders using special papers (e.g. A3, Bond, Glossy) will be tinted with these configured colors in Live Order &amp; Queue.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {['A3', 'Bond', 'Glossy', 'Envelope'].map((paperKey) => {
                  const currentColor = specializedColors[paperKey] || '#fef08a';
                  const colorPresets = [
                    { name: 'Yellow', hex: '#fef08a' },
                    { name: 'Sky', hex: '#bae6fd' },
                    { name: 'Purple', hex: '#e9d5ff' },
                    { name: 'Orange', hex: '#fed7aa' },
                    { name: 'Rose', hex: '#fecdd3' },
                    { name: 'Lime', hex: '#d9f99d' },
                  ];

                  return (
                    <div
                      key={paperKey}
                      className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                            style={{ backgroundColor: currentColor }}
                          />
                          <span>{paperKey} Paper</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Tint row in Live Queue
                        </p>
                      </div>

                      {/* Swatches */}
                      <div className="flex items-center gap-1.5">
                        {colorPresets.map((swatch) => (
                          <button
                            key={swatch.hex}
                            type="button"
                            title={swatch.name}
                            onClick={() => handleColorChange(paperKey, swatch.hex)}
                            className={`w-6 h-6 rounded-md border transition-all ${
                              currentColor === swatch.hex
                                ? 'scale-110 ring-2 ring-primary border-primary shadow-xs'
                                : 'border-border/60 hover:scale-105'
                            }`}
                            style={{ backgroundColor: swatch.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="p-2.5 bg-muted/40 border border-border/80 rounded-lg text-[11px] text-muted-foreground font-sans flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Highlighting preferences sync in real-time to Live Order &amp; Queue rows.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      )}

      {/* Add / Edit Dynamic Paper Type Modal */}
      <Dialog open={paperModalOpen} onOpenChange={setPaperModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground">
              {editingPaper ? 'Edit Paper Type' : 'Add New Paper Type'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase">Paper Type / Size Name</Label>
              <select
                value={paperName}
                onChange={(e) => setPaperName(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
              >
                <option value="">Select paper type or size</option>
                {DYNAMIC_PAPER_NAME_OPTIONS.map((name) => {
                  const alreadyAdded = paperTypes.some(
                    (paper) =>
                      paper.id !== editingPaper?.id &&
                      paper.name.toLowerCase() === name.toLowerCase()
                  );
                  return (
                    <option key={name} value={name} disabled={alreadyAdded}>
                      {name}{alreadyAdded ? ' (already added)' : ''}
                    </option>
                  );
                })}
                {editingPaper &&
                  !DYNAMIC_PAPER_NAME_OPTIONS.some(
                    (name) => name.toLowerCase() === editingPaper.name.toLowerCase()
                  ) && <option value={editingPaper.name}>{editingPaper.name}</option>}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase">B&amp;W Rate (₹/page)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={paperBwPrice}
                  onChange={(e) => setPaperBwPrice(e.target.value)}
                  className="text-xs h-9 font-mono rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase">Colour Rate (₹/page)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={paperColorPrice}
                  onChange={(e) => setPaperColorPrice(e.target.value)}
                  className="text-xs h-9 font-mono rounded-lg"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Special Paper Classification</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Enables specialized color highlighting in Live Orders queue.
                  </p>
                </div>
                <Switch
                  checked={paperIsSpecial}
                  onCheckedChange={setPaperIsSpecial}
                  disabled={editingPaper?.id === 'a4'}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Available to Customers</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Shows in User Panel paper size dropdown for this shop.
                  </p>
                </div>
                <Switch
                  checked={paperIsActive}
                  onCheckedChange={setPaperIsActive}
                  disabled={editingPaper?.id === 'a4'}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaperModalOpen(false)}
              disabled={savingPaper}
              className="text-xs h-9 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSavePaperType}
              disabled={savingPaper}
              className="text-xs h-9 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              {savingPaper ? 'Saving...' : 'Save Paper Type'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingPage;
