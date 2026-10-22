import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { ShopProfile } from '@/types/shopkeeper';
import { MapboxLocationModal } from '@/components/modals/MapboxLocationModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Clock,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Save,
  Plus,
  X,
  Camera,
  Trash2,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ProfilePage: React.FC = () => {
  const { shop, refreshShopData } = useShopkeeper();

  const [formData, setFormData] = useState<Partial<ShopProfile>>({});
  const [services, setServices] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [closedDays, setClosedDays] = useState<string[]>(['Sunday']);

  const [openTime, setOpenTime] = useState('08:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');

  const [newServiceTag, setNewServiceTag] = useState('');
  const [newEquipmentTag, setNewEquipmentTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mapboxModalOpen, setMapboxModalOpen] = useState(false);

  useEffect(() => {
    if (shop) {
      setFormData({
        name: shop.name || '',
        address: shop.address || '',
        landmark: (shop as any).landmark || '',
        latitude: (shop as any).latitude ? Number((shop as any).latitude) : 18.5204,
        longitude: (shop as any).longitude ? Number((shop as any).longitude) : 73.8567,
        contact_phone: shop.contact_phone || (shop as any).phone || '',
        email: shop.email || '',
        opening_hours: shop.opening_hours || '8:00 AM - 10:00 PM',
        image_url: shop.banner_url || (shop as any).logo_url || shop.image_url || '',
        banner_url: shop.banner_url || (shop as any).logo_url || shop.image_url || '',
        logo_url: (shop as any).logo_url || shop.banner_url || shop.image_url || '',
      });
      if (shop.opening_hours) {
        const parts = shop.opening_hours.split(' - ');
        if (parts.length >= 2) {
          setOpenTime(parts[0].trim());
          const endPart = parts[1].split('(')[0].trim();
          setCloseTime(endPart);
        }
      }
      setServices(shop.services || [
        'B&W High Speed Xerox',
        'Full Colour Laser Printing',
        'Spiral Binding',
        'Project Thesis Hardcover',
        'Thermal Lamination',
      ]);
      setEquipment(shop.equipment || [
        'Canon imageRUNNER ADVANCE Heavy Duty Multifunction',
        'HP Color LaserJet Enterprise Series',
        'Epson EcoTank L8050 Photo Quality Printer',
        'Industrial Hydraulic Paper Cutter & Creaser',
        'Thermal Binding & Laminating Station',
      ]);
      if (shop.closed_days && Array.isArray(shop.closed_days)) {
        setClosedDays(shop.closed_days);
      }
    }
  }, [shop]);

  // 3.1 Storefront Photo / Banner Upload with Validation
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error('Invalid format. Please select a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image exceeds 5MB size limit. Please upload a smaller image.');
      return;
    }

    setUploadingImage(true);
    const toastId = toast.loading('Uploading and persisting storefront banner...');
    try {
      const shopId = shop?.id || 'shop_01';
      const uploadedUrl = await shopkeeperApi.uploadShopImage(shopId, file);
      setFormData((prev) => ({
        ...prev,
        image_url: uploadedUrl,
        banner_url: uploadedUrl,
      }));
      await refreshShopData();
      toast.success('Storefront banner uploaded and saved to Supabase Storage!', { id: toastId });
    } catch {
      toast.error('Failed to upload banner image. Please try again.', { id: toastId });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveBanner = async () => {
    if (!confirm('Are you sure you want to remove the storefront banner?')) return;
    if (!shop?.id) return;

    try {
      await shopkeeperApi.removeShopBanner(shop.id);
      setFormData((prev) => ({
        ...prev,
        image_url: '',
        banner_url: '',
      }));
      await refreshShopData();
      toast.success('Storefront banner removed successfully');
    } catch {
      toast.error('Failed to remove banner');
    }
  };

  // Toggle Closed Days
  const toggleClosedDay = (day: string) => {
    setClosedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Service Tag handlers
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newServiceTag.trim();
    if (!tag) return;
    if (services.includes(tag)) {
      toast.error('This service tag is already added');
      return;
    }
    setServices([...services, tag]);
    setNewServiceTag('');
  };

  const handleRemoveService = (tagToRemove: string) => {
    setServices(services.filter((s) => s !== tagToRemove));
  };

  // Equipment Tag handlers
  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const item = newEquipmentTag.trim();
    if (!item) return;
    if (equipment.includes(item)) {
      toast.error('This equipment is already listed');
      return;
    }
    setEquipment([...equipment, item]);
    setNewEquipmentTag('');
  };

  const handleRemoveEquipment = (itemToRemove: string) => {
    setEquipment(equipment.filter((eq) => eq !== itemToRemove));
  };

  // 3.2 Form Validation & Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop?.id) return;

    // Validate non-empty name
    if (!formData.name?.trim()) {
      toast.error('Shop Name is required');
      return;
    }

    // Validate non-empty address
    if (!formData.address?.trim()) {
      toast.error('Shop Physical Address is required');
      return;
    }

    // Validate phone number (digits, min 10)
    const phoneClean = (formData.contact_phone || '').replace(/[^0-9]/g, '');
    if (!phoneClean || phoneClean.length < 10) {
      toast.error('Please enter a valid 10-digit customer support phone number');
      return;
    }

    // Validate email format if provided
    if (formData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    // Validate opening & closing times
    if (!openTime.trim() || !closeTime.trim()) {
      toast.error('Both opening and closing times are required');
      return;
    }

    // Compile operating hours
    const hoursSummary = `${openTime} - ${closeTime}${
      closedDays.length > 0 ? ` (Closed: ${closedDays.join(', ')})` : ''
    }`;

    setSaving(true);
    try {
      const updated: Partial<ShopProfile> = {
        ...formData,
        name: formData.name.trim(),
        address: formData.address.trim(),
        landmark: formData.landmark?.trim() || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        contact_phone: formData.contact_phone?.trim(),
        phone: formData.contact_phone?.trim(),
        email: formData.email?.trim() || 'contact@printon24.in',
        opening_hours: hoursSummary,
        closed_days: closedDays,
        services,
        equipment,
      };

      const success = await shopkeeperApi.updateShopProfile(shop.id, updated);
      if (success) {
        toast.success('Shop profile, hours, services & equipment synced with User Panel!');
        await refreshShopData();
      } else {
        toast.error('Failed to update shop profile');
      }
    } catch (err) {
      console.error('Failed to save shop profile:', err);
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast.error(`Failed to update shop profile: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const currentBanner = formData.banner_url || formData.image_url;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Storefront Identity &amp; Profile
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Shop Profile
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Manage your storefront banner, operating hours, machine equipment, and service tags displayed live on the User Panel.
          </p>
        </div>

        <Button
          onClick={handleSaveProfile}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold h-9 px-4 rounded-lg gap-1.5 shadow-sm self-start sm:self-center"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </Button>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* 3.1 Storefront Photo / Banner Section */}
        <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <span>Circular Storefront Profile Photo</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Display your verified storefront profile photo in a circular frame across the Shopkeeper and User customer apps.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Circular Storefront Photo Preview */}
              <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full bg-muted/50 border-4 border-card shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                {currentBanner ? (
                  <>
                    <img
                      src={currentBanner}
                      alt={formData.name || 'Storefront Photo'}
                      className="w-full h-full object-cover rounded-full transition-transform hover:scale-105 duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 rounded-full">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={handleRemoveBanner}
                        className="h-7 px-3 text-[10px] rounded-full gap-1 shadow-md font-semibold"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 space-y-1.5">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Camera className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-heading font-semibold text-foreground uppercase">
                      No Photo
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Upload circular avatar
                    </p>
                  </div>
                )}
              </div>

              {/* Upload & Actions */}
              <div className="space-y-3 flex-1 text-xs font-sans text-center md:text-left">
                <div>
                  <h4 className="font-heading font-bold text-foreground text-xs uppercase mb-1">
                    Storefront Photo (Circular Crop)
                  </h4>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Supported formats: <strong className="text-foreground">JPEG, PNG, WebP</strong>. Maximum file size: <strong className="text-foreground">5 MB</strong>. Uploaded photos are stored securely in Supabase Storage bucket and displayed as a clean circular profile picture across the platform.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold text-xs rounded-lg shadow-sm transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Uploading...' : currentBanner ? 'Change Photo' : 'Upload Storefront Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleImageFileChange}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>

                  {currentBanner && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveBanner}
                      className="h-8 text-xs rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3.2 Shop Details */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              <span>Shop Details &amp; Contact Information</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Enter verified contact information, landmark, and exact Mapbox pin location for your shop.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shop Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Shop Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Store className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Metro Print &amp; Xerox Hub"
                    className="pl-9 text-xs rounded-lg h-9"
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Contact Phone <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    value={formData.contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    required
                    placeholder="10-digit mobile number e.g. 9876543210"
                    className="pl-9 text-xs rounded-lg h-9 font-mono"
                  />
                </div>
              </div>

              {/* Contact Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Contact Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@printshop.in"
                    className="pl-9 text-xs rounded-lg h-9 font-mono"
                  />
                </div>
              </div>

              {/* Landmark */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Landmark
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMapboxModalOpen(true)}
                    className="h-5 text-[11px] text-primary hover:text-primary/80 gap-1 px-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Pick on Map</span>
                  </Button>
                </div>
                <div className="relative">
                  <Navigation className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    value={formData.landmark || ''}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    placeholder="e.g. Opposite Main College Gate, Near Metro Station"
                    className="pl-9 text-xs rounded-lg h-9"
                  />
                </div>
              </div>

              {/* Physical Address */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Physical Address <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMapboxModalOpen(true)}
                    className="h-6 text-[11px] text-primary border-primary/30 hover:bg-primary/10 gap-1 px-2 rounded-md font-semibold"
                  >
                    <MapPin className="w-3 h-3 text-primary" />
                    <span>Open Mapbox Map</span>
                  </Button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Click to locate on Mapbox map or enter full address"
                    required
                    className="pl-9 text-xs rounded-lg h-9"
                  />
                </div>
              </div>

              {/* Mapbox Coordinates Info Box */}
              <div className="md:col-span-2 p-3 bg-muted/40 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold text-foreground">Mapbox GPS Coordinates: </span>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      Latitude: {formData.latitude != null ? Number(formData.latitude).toFixed(5) : '18.52040'}, Longitude: {formData.longitude != null ? Number(formData.longitude).toFixed(5) : '73.85670'}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMapboxModalOpen(true)}
                  className="h-7 text-xs rounded-md gap-1 shrink-0 self-start sm:self-auto"
                >
                  <MapPin className="w-3 h-3 text-primary" />
                  <span>Adjust Pin on Map</span>
                </Button>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="pt-2 border-t border-border space-y-3">
              <Label className="text-xs font-heading font-bold uppercase text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Operating Hours &amp; Closed Days</span>
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Opening Time</Label>
                  <Input
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    placeholder="08:00 AM"
                    className="h-9 text-xs rounded-lg font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Closing Time</Label>
                  <Input
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    placeholder="10:00 PM"
                    className="h-9 text-xs rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Closed Days Selector */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground">Weekly Closed Days (Click to toggle)</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isClosed = closedDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleClosedDay(day)}
                        className={`px-3 py-1 text-xs rounded-lg border font-medium transition-colors ${
                          isClosed
                            ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : 'bg-muted/60 text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {day} {isClosed ? '(Closed)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3.2 Services Offered */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Services Offered</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Badges displayed under your shop profile on the customer app. Add or remove services as needed.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-4 text-xs font-sans">
            {/* Tag Badges */}
            <div className="flex flex-wrap gap-2">
              {services.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted border border-border rounded-lg text-foreground text-xs"
                >
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(tag)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                    title="Remove service"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Service Tag */}
            <div className="flex gap-2 max-w-md pt-1">
              <Input
                value={newServiceTag}
                onChange={(e) => setNewServiceTag(e.target.value)}
                placeholder="e.g. Spiral Binding, Glossy Photo, A3 Poster"
                className="text-xs rounded-lg h-9"
              />
              <Button
                type="button"
                onClick={handleAddService}
                variant="outline"
                className="text-xs rounded-lg h-9 shrink-0 font-medium"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Service
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3.2 Equipment & Printers List */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <span>Equipment &amp; Printers List</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Display the heavy-duty printers, plotters, and binding machines you operate to give customers confidence.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-4 text-xs font-sans">
            {/* Equipment Badges */}
            <div className="flex flex-wrap gap-2">
              {equipment.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted border border-border rounded-lg text-foreground text-xs font-mono"
                >
                  <Printer className="w-3 h-3 text-primary" />
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEquipment(item)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                    title="Remove equipment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Equipment */}
            <div className="flex gap-2 max-w-md pt-1">
              <Input
                value={newEquipmentTag}
                onChange={(e) => setNewEquipmentTag(e.target.value)}
                placeholder="e.g. Canon imageRUNNER DX C3830i, Epson Plotter"
                className="text-xs rounded-lg h-9 font-mono"
              />
              <Button
                type="button"
                onClick={handleAddEquipment}
                variant="outline"
                className="text-xs rounded-lg h-9 shrink-0 font-medium"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Machine
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save footer */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold h-9 px-5 rounded-lg gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
          </Button>
        </div>
      </form>

      {/* Mapbox Location Picker Modal */}
      <MapboxLocationModal
        open={mapboxModalOpen}
        onOpenChange={setMapboxModalOpen}
        initialAddress={formData.address || ''}
        initialLandmark={formData.landmark || ''}
        initialLat={formData.latitude != null ? Number(formData.latitude) : 18.5204}
        initialLng={formData.longitude != null ? Number(formData.longitude) : 73.8567}
        onConfirm={async ({ address, landmark, latitude, longitude }) => {
          setFormData((prev) => ({
            ...prev,
            address: address || prev.address,
            landmark: landmark !== undefined ? landmark : prev.landmark,
            latitude,
            longitude,
          }));

          // Direct database persistence for the current authenticated shop
          if (shop?.id) {
            try {
              await shopkeeperApi.updateShopProfile(shop.id, {
                address: address || formData.address,
                landmark: landmark !== undefined ? landmark : formData.landmark,
                latitude,
                longitude,
              });
              await refreshShopData();
              toast.success('Shop location and coordinates saved to database');
            } catch (err: any) {
              console.warn('Auto-save shop location error:', err);
            }
          }
        }}
      />
    </div>
  );
};

export default ProfilePage;
