import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { razorpayService } from '@/services/razorpayService';
import type { ShopSubscription, SubscriptionTier } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Check,
  Zap,
  Calendar,
  CreditCard,
  Sparkles,
  ArrowRight,
  Monitor,
  RotateCcw,
  AlertCircle,
  FileText,
  Lock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

export const SubscriptionPage: React.FC = () => {
  const { user, shop, refreshShopData } = useShopkeeper();

  const [availableTiers, setAvailableTiers] = useState<SubscriptionTier[]>([]);
  const [currentSub, setCurrentSub] = useState<ShopSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingTierId, setPurchasingTierId] = useState<string | null>(null);

  // Checkout modal confirmation state
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionTier | null>(null);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success'>('details');

  const loadSubscriptionData = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const [tiers, sub] = await Promise.all([
        shopkeeperApi.getSubscriptionPlansFromDB(),
        shopkeeperApi.getShopSubscription(user.shop_id),
      ]);
      setAvailableTiers(tiers);
      setCurrentSub(sub);
    } catch {
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionData();
  }, [user?.shop_id]);

  // Payment checkout flow
  const handleProceedPayment = (tier: SubscriptionTier) => {
    if (!user?.shop_id) {
      toast.error('Shop identifier missing. Please log in.');
      return;
    }

    setPurchasingTierId(tier.id);
    setSelectedPlanForCheckout(null);

    // Call Razorpay gateway / simulation with secure verification
    razorpayService.openCheckout({
      amount: tier.price_monthly,
      planId: tier.id,
      planName: tier.name,
      shopId: user.shop_id,
      shopName: shop?.name || user?.owner_name || 'printOn24 Workshop',
      userEmail: user.email || 'shop@printon24.in',
      userPhone: shop?.contact_phone || (user as any)?.phone || '9876543210',
      onSuccess: async (response) => {
        try {
          toast.loading('Verifying payment and activating subscription in database...');
          const success = await shopkeeperApi.activateSubscriptionPlan(
            user.shop_id,
            {
              id: tier.id,
              name: tier.name,
              price: tier.price_monthly,
              pc_limit: tier.allowed_pcs,
            },
            response.paymentId
          );

          if (success) {
            toast.dismiss();
            toast.success(
              `Payment Verified! (Ref: ${response.paymentId}). ${tier.name} activated with ${tier.allowed_pcs} PC licenses!`
            );
            await loadSubscriptionData();
            await refreshShopData();
          } else {
            toast.dismiss();
            toast.error('Payment succeeded, but database activation failed. Please contact support.');
          }
        } catch {
          toast.dismiss();
          toast.error('Error recording subscription activation.');
        } finally {
          setPurchasingTierId(null);
        }
      },
      onFailure: (errMsg) => {
        toast.error(`Payment Failed: ${errMsg}`);
        setPurchasingTierId(null);
      },
      onCancel: () => {
        toast.info('Subscription checkout cancelled.');
        setPurchasingTierId(null);
      },
    });
  };

  const daysRemaining = currentSub
    ? Math.max(
        0,
        Math.ceil(
          (new Date(currentSub.end_date || currentSub.expiry_date || Date.now()).getTime() -
            new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Commercial Licensing Quota
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Subscription Plans &amp; Counter Licenses
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Manage your shop operating tier, counter PC limits, billing validity, and process instant activations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSubscriptionData}
            disabled={loading}
            className="text-xs rounded-lg gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Active Subscription Validity Banner Card */}
      {currentSub && (
        <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden border-l-4 border-l-primary">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                    Active Subscription Validity
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground font-sans">
                    Current commercial license registered to Shop ID: <span className="font-mono font-bold text-foreground">{user?.shop_id}</span>
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white text-xs font-heading font-bold rounded-md px-2.5 py-1 gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Status: Active</span>
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                Active Plan Tier
              </div>
              <div className="text-base font-heading font-bold text-foreground">
                {currentSub.plan_name || currentSub.tier_name || 'Starter Print Plan'}
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                ₹{currentSub.price?.toLocaleString()} / 30 Days
              </div>
            </div>

            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                Allowed Counter PCs
              </div>
              <div className="text-base font-heading font-bold text-foreground flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-primary" />
                <span>{currentSub.pc_limit || currentSub.allowed_pcs || 2} PC Terminals</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Non-paying access strictly limited
              </div>
            </div>

            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                Validity Period
              </div>
              <div className="text-xs font-mono text-foreground font-bold">
                {new Date(currentSub.start_date).toLocaleDateString()} &rarr;{' '}
                {new Date(currentSub.end_date || currentSub.expiry_date).toLocaleDateString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Monthly Recurring Cycle</span>
              </div>
            </div>

            <div className="p-3.5 bg-muted/30 rounded-xl border border-border">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                Remaining Days
              </div>
              <div className="text-xl font-heading font-bold font-mono text-primary">
                {daysRemaining} Days Left
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Renews automatically or via manual top-up
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans from Database */}
      <div>
        <div className="mb-4">
          <h2 className="text-base md:text-lg font-heading font-bold uppercase text-foreground">
            Available Subscription Tiers (from Database)
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Choose a plan to upgrade your shop counter PC quota and unlock priority customer routing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {availableTiers.map((tier) => {
            const isCurrent =
              currentSub?.plan_id === tier.id ||
              currentSub?.plan_name === tier.name ||
              currentSub?.tier_name === tier.name;
            const isPurchasing = purchasingTierId === tier.id;

            return (
              <Card
                key={tier.id}
                className={`bg-card border rounded-xl shadow-sm flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-heading font-bold text-foreground">
                        {tier.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground font-sans mt-0.5">
                        {tier.allowed_pcs} Counter PC Terminal{tier.allowed_pcs > 1 ? 's' : ''} Allowed
                      </CardDescription>
                    </div>

                    {isCurrent ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-heading font-bold rounded-md">
                        Current Plan
                      </Badge>
                    ) : tier.is_popular ? (
                      <Badge className="bg-amber-500 text-white text-[10px] font-heading font-bold rounded-md">
                        Popular
                      </Badge>
                    ) : null}
                  </div>

                  <div className="pt-3">
                    <span className="text-3xl font-heading font-bold font-mono text-foreground">
                      ₹{tier.price_monthly.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono ml-1.5">
                      / month ({tier.duration_days || 30} days)
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 md:p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">
                      Plan Inclusions:
                    </div>
                    <ul className="space-y-2 text-xs font-sans text-foreground/90">
                      {(tier.features || []).map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-border mt-4">
                    <Button
                      onClick={() => setSelectedPlanForCheckout(tier)}
                      disabled={isPurchasing}
                      className={`w-full text-xs font-heading font-bold h-9 rounded-lg gap-2 shadow-sm ${
                        isCurrent
                          ? 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>
                        {isPurchasing
                          ? 'Connecting Gateway...'
                          : isCurrent
                          ? 'Renew This Plan'
                          : `Upgrade to ${tier.name}`}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Checkout Modal */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm uppercase text-foreground">
                  Confirm Subscription Order
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="h-7 w-7 p-0 rounded-md"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Selected Tier:</span>
                  <span className="font-heading font-bold text-foreground text-sm">
                    {selectedPlanForCheckout.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">PC Terminal Limit:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedPlanForCheckout.allowed_pcs} Terminals
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Validity Duration:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedPlanForCheckout.duration_days || 30} Days
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">Total Payable (incl. GST):</span>
                  <span className="font-mono font-black text-primary text-base">
                    ₹{selectedPlanForCheckout.price_monthly.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Payment is processed securely via Razorpay (UPI, Netbanking, Cards, Wallets). Upon successful payment verification, your subscription expiry and PC terminal limit will be automatically updated in the database.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="h-8 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleProceedPayment(selectedPlanForCheckout)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold text-xs h-8 px-4 rounded-lg shadow-sm gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Proceed to Payment</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
