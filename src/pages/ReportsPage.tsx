import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { PaymentReport, PrintReport, ReportFilterType } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  BarChart3,
  DollarSign,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileSpreadsheet,
  Building,
  RefreshCw,
  Wallet,
  Receipt,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageLockOverlay } from '@/components/PageLockOverlay';

export const ReportsPage: React.FC = () => {
  const { user } = useShopkeeper();

  // Page Lock Security State (Item 10)
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    if (!user?.shop_id) return;
    const checkLock = async () => {
      const configured = await shopkeeperApi.isReportsPasswordConfigured(user.shop_id);
      setIsLocked(configured);
    };
    checkLock();
  }, [user?.shop_id]);

  const [activeReportTab, setActiveReportTab] = useState<'payment' | 'print'>('payment');
  // Today is the default per requirement
  const [filter, setFilter] = useState<ReportFilterType>('Today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // View more toggle for 5 initial records
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const [paymentReport, setPaymentReport] = useState<PaymentReport | null>(null);
  const [printReport, setPrintReport] = useState<PrintReport | null>(null);

  const fetchReports = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const [payRep, prnRep] = await Promise.all([
        shopkeeperApi.getPaymentReport(user.shop_id, filter, customStart, customEnd),
        shopkeeperApi.getPrintReport(user.shop_id, filter, customStart, customEnd),
      ]);
      setPaymentReport(payRep);
      setPrintReport(prnRep);
    } catch {
      toast.error('Failed to load dynamic reports from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user?.shop_id, filter, customStart, customEnd]);

  const handleApplyCustomFilter = () => {
    if (!customStart) {
      toast.error('Please select a start date');
      return;
    }
    setFilter('Custom Date Range');
    setFilterPopoverOpen(false);
  };

  const handleExportCSV = (type: 'payment' | 'print') => {
    if (type === 'payment' && paymentReport) {
      const rows = [
        ['Report Type', 'Payment & Settlement Summary'],
        ['Filter Period', filter],
        ['Total Revenue Received', `INR ${paymentReport.total_revenue}`],
        ['Online Platform UPI', `INR ${paymentReport.online_total}`],
        ['Pay on Counter Cash', `INR ${paymentReport.counter_cash_total}`],
        ['Current Settled Bank Balance', `INR ${paymentReport.current_bank_balance}`],
        ['Pending Super Admin Settlement', `INR ${paymentReport.pending_settlement}`],
        [],
        ['Settlement Batch ID', 'Period', 'Amount (INR)', 'Status', 'Settled Date'],
        ...paymentReport.settlement_logs.map((s) => [
          s.id,
          s.period,
          s.amount,
          s.status,
          s.settled_at || 'Pending Super Admin Release',
        ]),
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `printOn24_PaymentReport_${filter}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Payment Report CSV exported');
    } else if (type === 'print' && printReport) {
      const rows = [
        ['Report Type', 'Print Volume Breakdown'],
        ['Filter Period', filter],
        ['Total Prints Completed', printReport.total_prints],
        ['Black & White Prints', printReport.bw_prints],
        ['Colour Prints', printReport.color_prints],
        ['Single Side Sheets', printReport.single_side_prints],
        ['Back-to-Back (Duplex) Sheets', printReport.back_to_back_prints],
        ['Standard A4 Prints', printReport.a4_prints],
        ['Large A3 Prints', printReport.a3_prints],
        ['Executive Bond Prints', printReport.bond_prints],
        ['Glossy Photo Prints', printReport.glossy_prints],
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `printOn24_PrintVolumeReport_${filter}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Print Volume Report CSV exported');
    }
  };

  const filterOptions: { label: string; value: ReportFilterType }[] = [
    { label: 'Today (Default)', value: 'Today' },
    { label: 'Yesterday', value: 'Yesterday' },
    { label: 'Last 7 Days', value: 'Last 7 Days' },
    { label: 'Last 30 Days', value: 'Last 30 Days' },
    { label: 'Custom Date Range', value: 'Custom Date Range' },
  ];

  return (
    <PageLockOverlay
      isLocked={isLocked}
      title="Report & Analytics"
      description="Confidential business turnover, bank settlements, and printing volume are protected by an administrative passcode."
      unlockButtonText="Unlock Your Report & Analytics Page"
      onVerifyPassword={async (pwd) => {
        if (!user?.shop_id) return false;
        return await shopkeeperApi.verifyReportsPassword(user.shop_id, pwd);
      }}
      onUnlockSuccess={() => setIsLocked(false)}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-mono uppercase text-muted-foreground">Financial & Spool Analytics</span>
            </div>
            <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
              Reports & Analytics
            </h1>
            <p className="text-xs text-muted-foreground font-sans">
              Real-time revenue collections, cash vs online transactions, settlement status from Super Admin, and print volume breakdowns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Functional Filter Popover with Icon */}
            <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-9 rounded-lg border-border font-semibold flex items-center gap-2"
                >
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  <span>Filter: {filter}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 space-y-3 bg-card border-border rounded-xl" align="end">
                <div className="text-xs font-heading font-bold uppercase text-foreground">Select Time Period</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {filterOptions.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={filter === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilter(opt.value);
                        if (opt.value !== 'Custom Date Range') setFilterPopoverOpen(false);
                      }}
                      className={`text-xs h-8 justify-start rounded-lg ${
                        filter === opt.value ? 'bg-primary text-primary-foreground font-semibold' : ''
                      }`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>

                {/* Custom Date Inputs */}
                <div className="pt-2 border-t border-border space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Custom Date Range</Label>
                  <div className="space-y-1.5">
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="text-xs h-8"
                      placeholder="Start date"
                    />
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="text-xs h-8"
                      placeholder="End date"
                    />
                    <Button
                      size="sm"
                      onClick={handleApplyCustomFilter}
                      className="w-full text-xs h-8 bg-primary text-primary-foreground font-semibold rounded-lg mt-1"
                    >
                      Apply Range
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchReports}
              className="text-xs h-9 rounded-lg"
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV(activeReportTab)}
              className="text-xs h-9 rounded-lg"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Tab Switcher: Payment vs Print Volume */}
        <div className="flex items-center justify-between">
          <Tabs
            value={activeReportTab}
            onValueChange={(val) => setActiveReportTab(val as 'payment' | 'print')}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-muted border border-border p-1 rounded-xl">
              <TabsTrigger
                value="payment"
                className="text-xs font-heading font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                Payment & Settlement
              </TabsTrigger>
              <TabsTrigger
                value="print"
                className="text-xs font-heading font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Volume & Media
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Badge variant="outline" className="text-xs font-mono hidden md:inline-flex py-1 px-2.5 rounded-lg">
            Filtered by: {filter} {filter === 'Custom Date Range' && customStart ? `(${customStart} to ${customEnd || 'Now'})` : ''}
          </Badge>
        </div>

        {/* ---------------- PAYMENT & SETTLEMENT TAB (Item 12) ---------------- */}
        {activeReportTab === 'payment' && (
          <div className="space-y-6">
            {/* Pay Online Status Notification */}
            {!paymentReport?.is_pay_online_enabled && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Note:</strong> Online Payment and Super Admin Bank Settlements are currently not enabled for this shopkeeper by the Super Admin. All transactions are recorded as Pay on Counter (Cash).
                </span>
              </div>
            )}

            {/* Financial Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground flex items-center justify-between">
                    <span>Total Revenue</span>
                    <Receipt className="w-4 h-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black font-mono text-foreground">
                    ₹{(paymentReport?.total_revenue || 0).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    {paymentReport?.revenue_change_percent !== undefined && (
                      <span className={`inline-flex items-center text-[11px] font-semibold ${
                        paymentReport.revenue_change_percent >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {paymentReport.revenue_change_percent >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        )}
                        {Math.abs(paymentReport.revenue_change_percent)}%
                      </span>
                    )}
                    <span>vs {paymentReport?.comparison_period || 'prior'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground flex items-center justify-between">
                    <span>Pay on Counter (Cash)</span>
                    <Wallet className="w-4 h-4 text-amber-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black font-mono text-foreground">
                    ₹{(paymentReport?.counter_cash_total || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {paymentReport?.counter_transactions_count || 0} cash orders at counter
                  </p>
                </CardContent>
              </Card>

              {paymentReport?.is_pay_online_enabled ? (
                <>
                  <Card className="bg-card border-border rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Online Platform (UPI)</span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black font-mono text-foreground">
                        ₹{(paymentReport?.online_total || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {paymentReport?.online_transactions_count || 0} app / QR payments
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground flex items-center justify-between">
                        <span>Pending Settlement</span>
                        <Clock className="w-4 h-4 text-blue-500" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                        ₹{(paymentReport?.pending_settlement || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Awaiting Super Admin transfer cycle
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-card border-border rounded-xl col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground">
                      Total Orders Processed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black font-mono text-foreground">
                      {paymentReport?.total_transactions || 0} Transactions
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      All settled directly at workshop counter
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Period Comparative Table (Item 12 Requirement) */}
            <Card className="bg-card border-border rounded-xl">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Comparative Period Analysis
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Compare performance metrics of the current timeframe against {paymentReport?.comparison_period || 'the previous period'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full max-w-full overflow-x-auto bg-card">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Metric</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">Current Period ({filter})</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">Previous Period ({paymentReport?.comparison_period || 'Prior'})</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">Variance / Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">Gross Revenue</td>
                        <td className="py-3 px-4 text-right font-bold text-foreground whitespace-nowrap">
                          ₹{(paymentReport?.total_revenue || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">
                          ₹{(paymentReport?.comparison_revenue || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center font-bold ${
                            (paymentReport?.revenue_change_percent || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {(paymentReport?.revenue_change_percent || 0) >= 0 ? '+' : ''}
                            {paymentReport?.revenue_change_percent || 0}%
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">Completed Transactions</td>
                        <td className="py-3 px-4 text-right font-bold text-foreground whitespace-nowrap">
                          {paymentReport?.total_transactions || 0}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">
                          {paymentReport?.comparison_transactions || 0}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap text-muted-foreground">
                          {(paymentReport?.total_transactions || 0) - (paymentReport?.comparison_transactions || 0) >= 0 ? '+' : ''}
                          {(paymentReport?.total_transactions || 0) - (paymentReport?.comparison_transactions || 0)} orders
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Real Supabase Payment Transactions (Initial 5 + View More) */}
            <Card className="bg-card border-border rounded-xl">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                      Real Customer Payment Records
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Individual print orders with payment mode separation (Counter Cash vs Online UPI).
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    Total Records: {paymentReport?.transactions?.length || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full max-w-full overflow-x-auto bg-card">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Order / Token</th>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Customer</th>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Payment Mode</th>
                        <th className="py-2.5 px-4 text-right whitespace-nowrap">Amount</th>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Status</th>
                        <th className="py-2.5 px-4 text-left whitespace-nowrap">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paymentReport?.transactions && paymentReport.transactions.length > 0 ? (
                        (showAllTransactions
                          ? paymentReport.transactions
                          : paymentReport.transactions.slice(0, 5)
                        ).map((txn) => (
                          <tr key={txn.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                              {txn.token_number}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {txn.customer_name || 'Walk-in Customer'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {txn.is_online ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                  Online UPI
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                  Pay on Counter (Cash)
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-foreground whitespace-nowrap">
                              ₹{txn.amount.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                {txn.payment_status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {new Date(txn.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground">
                            No payment records found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* View More / View Less Button */}
                {paymentReport?.transactions && paymentReport.transactions.length > 5 && (
                  <div className="p-3 border-t border-border flex justify-center bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllTransactions(!showAllTransactions)}
                      className="text-xs font-semibold gap-1.5 h-8"
                    >
                      {showAllTransactions ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Show Less (Top 5 Only)</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>View More ({paymentReport.transactions.length - 5} additional records)</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Super Admin Settlement Log Table (Visible if Pay Online is enabled or settlement records exist) */}
            {(paymentReport?.is_pay_online_enabled || (paymentReport?.settlement_logs && paymentReport.settlement_logs.length > 0)) && (
              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                        Super Admin Bank Settlement Batches
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Settlement status updates automatically when Super Admin completes transfers to your registered bank account.
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total Settled to Bank</div>
                      <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{(paymentReport?.current_bank_balance || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full max-w-full overflow-x-auto bg-card">
                    <table className="w-full text-xs font-mono">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px]">
                        <tr>
                          <th className="py-2.5 px-4 text-left whitespace-nowrap">Batch ID</th>
                          <th className="py-2.5 px-4 text-left whitespace-nowrap">Billing Cycle</th>
                          <th className="py-2.5 px-4 text-left whitespace-nowrap">Net Payable</th>
                          <th className="py-2.5 px-4 text-left whitespace-nowrap">Transfer Status</th>
                          <th className="py-2.5 px-4 text-left whitespace-nowrap">Bank Reference</th>
                          <th className="py-2.5 px-4 text-left whitespace-nowrap">Settled Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paymentReport?.settlement_logs && paymentReport.settlement_logs.length > 0 ? (
                          paymentReport.settlement_logs.map((log) => (
                            <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                              <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">{log.id}</td>
                              <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{log.period}</td>
                              <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">₹{log.amount.toLocaleString()}</td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {log.status === 'Completed' || log.status === 'Settled' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Completed
                                  </span>
                                ) : log.status === 'Failed' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                                    <XCircle className="w-3 h-3" />
                                    Failed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                                    <Clock className="w-3 h-3" />
                                    In Progress
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{log.reference_no}</td>
                              <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                                {log.settled_at || 'Pending Super Admin Release'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                              No settlements logged yet for this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ---------------- PRINT VOLUME & MEDIA TAB (Item 13) ---------------- */}
        {activeReportTab === 'print' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground">
                    Total Completed Prints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black font-mono text-foreground">
                    {(printReport?.total_prints || 0).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    {printReport?.prints_change_percent !== undefined && (
                      <span className={`inline-flex items-center text-[11px] font-semibold ${
                        printReport.prints_change_percent >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {printReport.prints_change_percent >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        )}
                        {Math.abs(printReport.prints_change_percent)}%
                      </span>
                    )}
                    <span>vs {printReport?.comparison_period || 'prior'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground">
                    Black &amp; White Prints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black font-mono text-foreground">
                    {(printReport?.bw_prints || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {printReport?.total_prints
                      ? `${Math.round(((printReport.bw_prints || 0) / printReport.total_prints) * 100)}% of total volume`
                      : '0%'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground">
                    Colour Prints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black font-mono text-primary">
                    {(printReport?.color_prints || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {printReport?.total_prints
                      ? `${Math.round(((printReport.color_prints || 0) / printReport.total_prints) * 100)}% of total volume`
                      : '0%'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 4-Way Breakdown Matrix (Item 13 Requirement) */}
            <Card className="bg-card border-border rounded-xl">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Color &amp; Duplex 4-Way Breakdown Matrix
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Exact distribution across Color Single Side, Color Duplex, B&amp;W Single Side, and B&amp;W Duplex.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
                      Color Single Side
                    </span>
                    <div className="text-2xl font-bold font-mono text-primary">
                      {(printReport?.fourWayMatrix?.color_single || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Full color, single sheet</span>
                  </div>

                  <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
                      Color Duplex (Back-to-Back)
                    </span>
                    <div className="text-2xl font-bold font-mono text-primary">
                      {(printReport?.fourWayMatrix?.color_duplex || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Full color, 2-sided</span>
                  </div>

                  <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
                      B&amp;W Single Side
                    </span>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {(printReport?.fourWayMatrix?.bw_single || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Monochrome, single sheet</span>
                  </div>

                  <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
                      B&amp;W Duplex (Back-to-Back)
                    </span>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {(printReport?.fourWayMatrix?.bw_duplex || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Monochrome, 2-sided</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Media Formats & Sides Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                    Sides Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Single Side Sheets:</span>
                    <span className="font-bold text-foreground">{(printReport?.single_side_prints || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Back-to-Back (Duplex) Sheets:</span>
                    <span className="font-bold text-foreground">{(printReport?.back_to_back_prints || 0).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-xl">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                    Paper Formats &amp; Media Types
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground">Standard A4:</span>
                    <span className="font-bold text-foreground">{(printReport?.a4_prints || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground">Large A3 / Ledger:</span>
                    <span className="font-bold text-foreground">{(printReport?.a3_prints || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground">Compact A5:</span>
                    <span className="font-bold text-foreground">{(printReport?.a5_prints || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-muted-foreground">Executive Bond Paper:</span>
                    <span className="font-bold text-foreground">{(printReport?.bond_prints || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Glossy Photo Paper:</span>
                    <span className="font-bold text-foreground">{(printReport?.glossy_prints || 0).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PageLockOverlay>
  );
};

export default ReportsPage;
