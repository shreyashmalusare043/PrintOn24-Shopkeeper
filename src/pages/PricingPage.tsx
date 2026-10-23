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
  const [calcCopies, setCalcCopies] = useState(1);
  const [calcPrintType, setCalcPrintType] = useState<'bw' | 'color'>('bw');
  const [calcSides, setCalcSides] = useState<'single' | 'back_to_back'>('single');
  const [calcPaperSize, setCalcPaperSize] = useState<'a4' | 'a3'>('a4');

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

    const ratePerPage = Math.max(0.5, baseRate + paperSurcharge);
    return Math.round(ratePerPage * calcPages * calcCopies * 100) / 100;
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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Paper Size & Specialty Media Types */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  2. Paper Sizes &amp; Specialty Media Rates
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-sans">
                  Standard sizes (A4, A3) and media surcharge rates.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* A4 Paper Rate */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">
                      A4 Paper Base Rate
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={pricing.a4_rate}
                        onChange={(e) => setPricing({ ...pricing, a4_rate: parseFloat(e.target.value) || 0 })}
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Included standard sheet cost</p>
                  </div>

                  {/* A3 Paper Rate */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">
                      A3 Large Format Rate
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.5"
                        min="1"
                        value={pricing.a3_rate}
                        onChange={(e) => setPricing({ ...pricing, a3_rate: parseFloat(e.target.value) || 0 })}
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Double size ledger sheets</p>
                  </div>

                  {/* Bond Paper Surcharge */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">
                      Executive Bond Paper (+₹)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={pricing.bond_paper_rate}
                        onChange={(e) =>
                          setPricing({ ...pricing, bond_paper_rate: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Premium resume/letterhead stock</p>
                  </div>

                  {/* Glossy Photo Paper Surcharge */}
                  <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground uppercase">
                      Glossy Photo Paper (+₹)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={pricing.glossy_paper_rate}
                        onChange={(e) =>
                          setPricing({ ...pricing, glossy_paper_rate: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-7 text-sm font-mono font-bold rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">High resolution photo media</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Finishing & Add-ons Services */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                  3. Post-Processing &amp; Finishing Services
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

            {/* 4. Dynamic Paper Types & Media Matrix (Item 14) */}
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>4. Dynamic Paper Types &amp; Sizes</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground font-sans">
                    Configure custom paper sizes (A4, A3, A5, Bond, Glossy, Envelope, Jumbo) with individual B&amp;W and Color pricing.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenAddPaper}
                  className="text-xs font-semibold h-8 rounded-lg bg-primary text-primary-foreground gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Paper Type</span>
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                <div className="w-full max-w-full overflow-x-auto bg-card">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Paper Size / Type</th>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Category</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">B&amp;W Rate (₹)</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">Colour Rate (₹)</th>
                        <th className="py-2.5 px-4 text-center whitespace-nowrap">Availability</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paperTypes.map((pt) => (
                        <tr key={pt.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{pt.name}</span>
                              {pt.id === 'a4' && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  Default
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {pt.is_special ? (
                              <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                                Special Paper
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Normal Paper
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-foreground whitespace-nowrap">
                            ₹{Number(pt.bw_price).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-primary whitespace-nowrap">
                            ₹{Number(pt.color_price).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {pt.id === 'a4' ? (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Always Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePaperActive(pt.id, pt.is_active)}
                                disabled={savingPaper}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                                  pt.is_active
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                {pt.is_active ? 'Active' : 'Deactivated'}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditPaper(pt)}
                                disabled={savingPaper}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Edit paper type"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              {pt.id !== 'a4' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePaper(pt)}
                                  disabled={savingPaper}
                                  className="h-7 w-7 p-0 text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                                  title="Delete paper type"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  Simulates user portal invoice calculations instantly.
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
                      onClick={() => setCalcPrintType('bw')}
                      className={`h-8 text-xs rounded-lg gap-1.5 ${calcPrintType === 'bw' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      <Circle className="w-3 h-3" />
                      <span>Black &amp; White</span>
                    </Button>
                    <Button
                      type="button"
                      variant={calcPrintType === 'color' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcPrintType('color')}
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
                      className={`h-8 text-xs rounded-lg ${calcSides === 'single' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      Single Side
                    </Button>
                    <Button
                      type="button"
                      variant={calcSides === 'back_to_back' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcSides('back_to_back')}
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
                      className={`h-8 text-xs rounded-lg ${calcPaperSize === 'a4' ? 'bg-primary text-primary-foreground font-semibold' : ''}`}
                    >
                      A4 Standard
                    </Button>
                    <Button
                      type="button"
                      variant={calcPaperSize === 'a3' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalcPaperSize('a3')}
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
                    ({calcPages * calcCopies} printed impressions)
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
