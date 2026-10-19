import React, { useState, useEffect, useMemo } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { UserMembership, ShopPricing } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  Percent,
  Calendar,
  Save,
  Search,
  Crown,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 8;

export const MembershipsPage: React.FC = () => {
  const { user, t, shop } = useShopkeeper();

  const [members, setMembers] = useState<UserMembership[]>([]);
  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Editable settings
  const [membershipEnabled, setMembershipEnabled] = useState(true);
  const [monthlyFee, setMonthlyFee] = useState(199);
  const [discountPercent, setDiscountPercent] = useState(15);
  const [billingCycle, setBillingCycle] = useState('Monthly');

  const fetchData = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const [membersData, pricingData] = await Promise.all([
        shopkeeperApi.getShopMemberships(user.shop_id),
        shopkeeperApi.getShopPricing(user.shop_id),
      ]);

      setMembers(membersData);
      if (pricingData) {
        setPricing(pricingData);
        setMembershipEnabled(!!pricingData.membership_enabled);
        setMonthlyFee(pricingData.membership_monthly_fee ?? 199);
        setDiscountPercent(pricingData.membership_discount_percent ?? 15);
        setBillingCycle(pricingData.membership_billing_cycle || 'Monthly');
      }
    } catch {
      toast.error('Failed to load membership records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.shop_id]);

  const handleSaveMembershipSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.shop_id) return;

    if (monthlyFee < 0) {
      toast.error('Monthly membership fee cannot be negative');
      return;
    }
    if (discountPercent < 0 || discountPercent > 100) {
      toast.error('Discount percent must be between 0% and 100%');
      return;
    }

    setSavingSettings(true);
    try {
      const updatedPricing: ShopPricing = {
        ...(pricing || {
          id: `prc_${user.shop_id}`,
          shop_id: user.shop_id,
          bw_single: 1.0,
          bw_double: 1.5,
          bw_back_to_back: 1.5,
          color_single: 5.0,
          color_double: 8.0,
          color_back_to_back: 8.0,
          a4_rate: 1.0,
          a3_rate: 4.0,
          bond_rate: 2.0,
          bond_paper_rate: 2.0,
          glossy_rate: 5.0,
          glossy_paper_rate: 5.0,
        }),
        membership_enabled: membershipEnabled,
        membership_monthly_fee: monthlyFee,
        membership_discount_percent: discountPercent,
        membership_billing_cycle: billingCycle,
      };

      const success = await shopkeeperApi.updatePricing(updatedPricing);
      if (success) {
        setPricing(updatedPricing);
        toast.success('Membership rules & pricing saved and synced with User Panel!');
      } else {
        toast.error('Failed to save membership rules');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleMemberStatus = async (membershipId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    const success = await shopkeeperApi.toggleMemberStatus(membershipId, nextStatus);
    if (success) {
      toast.success(`Member status updated to ${nextStatus}`);
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, status: nextStatus } : m))
      );
    }
  };

  // Re-compute active vs expired status in real-time
  const now = new Date();
  const activeMembers = useMemo(
    () => members.filter((m) => {
      if (m.status !== 'active') return false;
      if (!m.end_date) return true;
      return new Date(m.end_date) >= now;
    }),
    [members, now]
  );

  const expiredMembers = useMemo(
    () => members.filter((m) => {
      if (m.status !== 'active') return true;
      if (!m.end_date) return false;
      return new Date(m.end_date) < now;
    }),
    [members, now]
  );

  const filteredList = useMemo(() => {
    const list = activeTab === 'active' ? activeMembers : expiredMembers;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (m) =>
        (m.user_name && m.user_name.toLowerCase().includes(q)) ||
        (m.user_phone && m.user_phone.toLowerCase().includes(q)) ||
        (m.user_email && m.user_email.toLowerCase().includes(q)) ||
        (m.membership_tier && m.membership_tier.toLowerCase().includes(q))
    );
  }, [activeTab, activeMembers, expiredMembers, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / ITEMS_PER_PAGE));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Customer Loyalty &amp; Subscriptions
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            {t('memberships')}
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Configure shop-specific membership rules, pricing, discount tiers, and track active customer registry.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="self-start sm:self-center text-xs rounded-lg gap-1.5 h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Members</p>
              <h3 className="text-xl font-heading font-bold text-foreground">{members.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Active Members</p>
              <h3 className="text-xl font-heading font-bold text-emerald-600 dark:text-emerald-400">
                {activeMembers.length}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Expired / Cancelled</p>
              <h3 className="text-xl font-heading font-bold text-muted-foreground">
                {expiredMembers.length}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- 1.1 SHOP MEMBERSHIP RULES & PRICING SETUP ---------------- */}
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
            Shop Membership Rules &amp; Pricing Setup
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground font-sans">
            Set customer discount membership rules for {shop?.name || 'your print shop'}. Synced automatically to the User Panel.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSaveMembershipSettings} className="space-y-4">
            {/* Toggle switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground uppercase">
                    Enable Customer Membership Program
                  </span>
                  {membershipEnabled ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold rounded-md">ACTIVE ON USER APP</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground rounded-md">
                      DISABLED
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  When enabled, customers can discover and purchase discount memberships for your shop on the User Panel.
                </p>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <Switch
                  checked={membershipEnabled}
                  onCheckedChange={setMembershipEnabled}
                />
              </div>
            </div>

            {/* Config Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="space-y-1.5 p-3.5 bg-card border border-border rounded-xl">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  Monthly Membership Fee (₹)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!membershipEnabled}
                    className="pl-7 text-sm font-mono font-bold rounded-lg"
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-sans">Real fee charged to customer per cycle</p>
              </div>

              <div className="space-y-1.5 p-3.5 bg-card border border-border rounded-xl">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-primary" />
                  Order Discount Rate (%)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">%</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    disabled={!membershipEnabled}
                    className="pl-7 text-sm font-mono font-bold rounded-lg"
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-sans">Automatic discount applied at checkout</p>
              </div>

              <div className="space-y-1.5 p-3.5 bg-card border border-border rounded-xl">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Default Billing Cycle
                </Label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value)}
                  disabled={!membershipEnabled}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Monthly">Monthly (30 Days)</option>
                  <option value="Quarterly">Quarterly (90 Days)</option>
                  <option value="Yearly">Yearly (365 Days)</option>
                </select>
                <p className="text-[10px] text-muted-foreground font-sans">Membership validity billing period</p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={savingSettings}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold rounded-lg h-9 px-4 gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Membership Rules'}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---------------- 1.3 ACTIVE MEMBER REGISTRY & EXPIRED MEMBERS ---------------- */}
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Customer Member Registry</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-sans">
                Real-time registry of customers who purchased VIP membership for {shop?.name || 'this shop'}.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                placeholder="Search member name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <div className="px-4 pt-3 border-b border-border">
              <TabsList className="bg-muted/60 p-1 rounded-lg">
                <TabsTrigger value="active" className="text-xs rounded-md gap-1.5 font-semibold">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Active Members ({activeMembers.length})</span>
                </TabsTrigger>
                <TabsTrigger value="expired" className="text-xs rounded-md gap-1.5 font-semibold">
                  <UserX className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Expired Members ({expiredMembers.length})</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="m-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left font-sans">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">Member Customer</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 whitespace-nowrap">Tier &amp; Discount</th>
                      <th className="py-3 px-4 whitespace-nowrap">Cycle &amp; Fee</th>
                      <th className="py-3 px-4 whitespace-nowrap">Start Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">Expiry Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">Days Remaining</th>
                      <th className="py-3 px-4 whitespace-nowrap">Payment Reference</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground font-sans">
                          Loading membership records...
                        </td>
                      </tr>
                    ) : paginatedList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground font-sans">
                          No {activeTab} members found.
                        </td>
                      </tr>
                    ) : (
                      paginatedList.map((m) => {
                        const isCurrentlyActive = m.status === 'active' && (!m.end_date || new Date(m.end_date) >= now);
                        const daysLeft = m.days_remaining ?? (m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0);

                        return (
                          <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-semibold text-foreground text-xs">
                                {m.user_name || 'VIP Member'}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {m.user_phone || 'Registered Customer'}
                                {m.user_email ? ` • ${m.user_email}` : ''}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {isCurrentlyActive ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] font-bold rounded-md">
                                  ACTIVE
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px] rounded-md">
                                  EXPIRED
                                </Badge>
                              )}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-md">
                                  {m.membership_tier}
                                </Badge>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                                  {m.discount_percent || discountPercent}% OFF
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="text-foreground font-medium text-xs">
                                ₹{m.fee_paid ?? monthlyFee}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {m.billing_cycle || billingCycle}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                              {m.start_date ? new Date(m.start_date).toLocaleDateString() : 'N/A'}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                              {m.end_date ? new Date(m.end_date).toLocaleDateString() : 'N/A'}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {isCurrentlyActive ? (
                                <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
                                  daysLeft <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                                }`}>
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  {daysLeft} days
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs font-mono">0 days</span>
                              )}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap font-mono text-muted-foreground text-[11px]">
                              {m.payment_reference || 'MEM-ONLINE-TXN'}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleMemberStatus(m.id, m.status)}
                                className="h-7 text-xs rounded-lg gap-1"
                              >
                                <Power className="w-3 h-3" />
                                <span>{isCurrentlyActive ? 'Expire' : 'Activate'}</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Page {currentPage} of {totalPages} ({filteredList.length} total)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-7 px-2 text-xs rounded-md"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-7 px-2 text-xs rounded-md"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MembershipsPage;
