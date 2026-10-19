import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { PrintOrder, ShopPrinter } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  Monitor,
  CheckCircle2,
  Clock,
  ArrowRight,
  QrCode,
  Sliders,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, shop, pcs, selectedPcId, t } = useShopkeeper();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [printers, setPrinters] = useState<ShopPrinter[]>([]);
  const [metrics, setMetrics] = useState({
    todayPrints: 0,
    yesterdayPrints: 0,
    totalPrints: 0,
    totalRevenue: 0,
    onlineRevenue: 0,
    counterCash: 0,
    activeJobsCount: 0,
    todayGrowthPct: 0,
  });

  const loadDashboardData = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const [orderList, printerList, allShopOrders] = await Promise.all([
        shopkeeperApi.getLiveOrders(user.shop_id, selectedPcId),
        shopkeeperApi.getShopPrinters(user.shop_id),
        shopkeeperApi.getAllOrders(user.shop_id),
      ]);

      setOrders(orderList);
      setPrinters(printerList);

      // Real dynamic date-based calculations
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yestDate = new Date(Date.now() - 86400000);
      const yestStr = yestDate.toISOString().split('T')[0];

      const ordersSource = allShopOrders.length > 0 ? allShopOrders : orderList;

      const todayOrders = ordersSource.filter((o: PrintOrder) => o.created_at?.startsWith(todayStr));
      const yesterdayOrders = ordersSource.filter((o: PrintOrder) => o.created_at?.startsWith(yestStr));

      const todayPages = todayOrders.reduce((sum: number, o: PrintOrder) => sum + (Number(o.total_pages || 1) * Number(o.config_copies || 1)), 0);
      const yestPages = yesterdayOrders.reduce((sum: number, o: PrintOrder) => sum + (Number(o.total_pages || 1) * Number(o.config_copies || 1)), 0);
      const totalPages = ordersSource.reduce((sum: number, o: PrintOrder) => sum + (Number(o.total_pages || 1) * Number(o.config_copies || 1)), 0);

      const totalRev = ordersSource
        .filter((o: PrintOrder) => o.payment_status === 'Completed' || o.order_status === 'Completed')
        .reduce((sum: number, o: PrintOrder) => sum + Number(o.grand_total || 0), 0);

      const onlineRev = ordersSource
        .filter((o: PrintOrder) => (o.payment_method === 'Online' || o.payment_method === 'UPI') && (o.payment_status === 'Completed' || o.order_status === 'Completed'))
        .reduce((sum: number, o: PrintOrder) => sum + Number(o.grand_total || 0), 0);

      const cashRev = ordersSource
        .filter((o: PrintOrder) => (o.payment_method === 'Cash' || o.payment_method === 'Counter') && (o.payment_status === 'Completed' || o.order_status === 'Completed'))
        .reduce((sum: number, o: PrintOrder) => sum + Number(o.grand_total || 0), 0);

      const growth = yestPages > 0 ? Math.round(((todayPages - yestPages) / yestPages) * 100) : todayPages > 0 ? 100 : 0;

      setMetrics({
        todayPrints: todayPages,
        yesterdayPrints: yestPages,
        totalPrints: totalPages,
        totalRevenue: Math.round(totalRev),
        onlineRevenue: Math.round(onlineRev),
        counterCash: Math.round(cashRev),
        activeJobsCount: orderList.filter((o: PrintOrder) => o.order_status !== 'Completed' && o.order_status !== 'Cancelled').length,
        todayGrowthPct: growth,
      });
    } catch (e) {
      console.warn('Dashboard data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    if (!user?.shop_id) return;
    const sub = shopkeeperApi.subscribeToOrders(user.shop_id, () => {
      loadDashboardData();
    });

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [user?.shop_id, selectedPcId]);

  const activeJobs = orders
    .filter((o) => o.order_status !== 'Completed' && o.order_status !== 'Cancelled')
    .slice(0, 5);

  const onlinePcs = pcs.filter((p) => p.status === 'online');
  const onlinePrinters = printers.filter((p) => p.status === 'online');

  return (
    <div className="space-y-6">
      {/* Top Banner / Workshop Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">

            <span className="text-xs font-mono uppercase text-muted-foreground">Workshop Live Feed</span>
            {selectedPcId !== 'all' && (
              <Badge variant="outline" className="text-[10px] font-mono border-primary text-primary">
                Filtered: {pcs.find((p) => p.id === selectedPcId)?.pc_name}
              </Badge>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            {shop?.name || 'Campus Fast Print'}
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            {shop?.address} • Terminal ID: <strong className="text-primary font-mono">{shop?.terminal_code}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/orders')}
            className="bg-card border border-border hover:bg-muted text-foreground text-xs font-sans font-semibold rounded-lg h-9 shadow-sm"
          >
            Open Live Queue
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-primary" />
          </Button>
        </div>
      </div>
      {/* ---------------- 1. PRINT COUNTERS & REVENUE STATS (SRS 1) ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Printing */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-sans uppercase font-semibold text-muted-foreground">
              {t('todaysPrints')}
            </CardTitle>
            <FileText className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-foreground">{metrics.todayPrints}</div>
            <p className="text-[11px] text-muted-foreground font-sans mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>+18% compared to yesterday</span>
            </p>
          </CardContent>
        </Card>

        {/* Yesterday's Printing */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-sans uppercase font-semibold text-muted-foreground">
              {t('yesterdaysPrints')}
            </CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-foreground">{metrics.yesterdayPrints}</div>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">Archived 24h count</p>
          </CardContent>
        </Card>

        {/* Total Lifetime Prints */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-sans uppercase font-semibold text-muted-foreground">
              {t('totalPrints')}
            </CardTitle>
            <Printer className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-foreground">
              {metrics.totalPrints.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">Aggregated terminal total</p>
          </CardContent>
        </Card>

        {/* Total Revenue & Payment Breakdown */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-sans uppercase font-semibold text-muted-foreground">
              {t('totalRevenue')}
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-foreground">
              ₹{metrics.totalRevenue.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground font-sans mt-1 flex justify-between">
              <span>UPI: ₹{metrics.onlineRevenue}</span>
              <span className="text-foreground font-medium">Cash: ₹{metrics.counterCash}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* ---------------- 2. DEVICE & TERMINAL STATUS GRID ---------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connected PCs Status */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-mono uppercase text-foreground">
                Connected PC Terminals
              </CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                {onlinePcs.length} of {pcs.length} counter terminals operational
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/qr-pc')}
              className="text-xs font-mono h-7"
            >
              Manage PCs
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pcs.map((pc) => (
              <div
                key={pc.id}
                className="flex items-center justify-between p-2.5 bg-muted/40 border border-border"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-card border border-border flex items-center justify-center text-primary">
                    <Monitor className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-semibold text-foreground">{pc.pc_name}</span>
                      {pc.is_default && (
                        <span className="text-[9px] uppercase px-1 py-0.2 bg-primary/20 text-primary border border-primary/40 font-mono">
                          Master
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">IP: {pc.ip_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                      pc.status === 'online' ? 'text-emerald-500' : 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        pc.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground'
                      }`}
                    />
                    {pc.status === 'online' ? t('online') : t('offline')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/qr-pc')}
                    className="h-6 px-1.5 text-[10px] font-mono text-primary"
                  >
                    QR
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Connected Printers & Capabilities */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-mono uppercase text-foreground">
                Active Printer Hardware
              </CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                {onlinePrinters.length} detected via USB and Local Network
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/printers')}
              className="text-xs font-mono h-7"
            >
              Configure
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {printers.slice(0, 3).map((prn) => (
              <div
                key={prn.id}
                className="flex items-center justify-between p-2.5 bg-muted/40 border border-border"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-7 h-7 bg-card border border-border flex items-center justify-center text-primary shrink-0">
                    <Printer className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-foreground truncate">{prn.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {prn.capabilities.color ? 'Color' : 'B&W'} •{' '}
                      {prn.capabilities.double_side ? 'Duplex' : 'Simplex'} • {prn.connection_type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shrink-0">
                  READY
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {/* ---------------- 3. ACTIVE PRINT JOBS PREVIEW ---------------- */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-mono uppercase text-foreground">
                {t('activeJobs')}
              </CardTitle>
              <Badge className="bg-primary text-primary-foreground font-mono text-[10px]">
                {activeJobs.length} In Progress
              </Badge>
            </div>
            <CardDescription className="text-xs font-mono text-muted-foreground">
              Incoming user documents routed to counter queue
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/orders')}
            className="text-xs font-mono bg-primary text-primary-foreground self-start sm:self-auto"
          >
            View Full Queue
          </Button>
        </CardHeader>

        <CardContent>
          {activeJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
              No active print orders right now. Counter is clear.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-muted text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Token</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Document</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Configuration</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Target PC</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Amount</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeJobs.map((ord) => (
                    <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-primary">
                        {ord.token_number}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground truncate max-w-[180px]">
                          {ord.document_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {ord.customer_name || ord.user_name || 'Customer'} • {ord.total_pages} pages × {ord.config_copies} copies
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] text-muted-foreground">
                          {ord.config_print_type} • {ord.config_sides} • {ord.config_page_size}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 bg-muted border border-border">
                          {ord.target_pc_name || 'PC 1'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-foreground">
                        ₹{ord.grand_total}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {ord.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase font-mono border ${
                            ord.order_status === 'Printing'
                              ? 'bg-primary/20 text-primary border-primary animate-pulse'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {ord.order_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/orders')}
                          className="h-7 px-2 text-[11px] font-mono"
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* ---------------- 4. QUICK WORKSHOP ACTIONS ---------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          variant="outline"
          onClick={() => navigate('/qr-pc')}
          className="h-auto py-3 flex flex-col items-center gap-1.5 border-border bg-card hover:bg-muted/50 font-mono text-xs"
        >
          <QrCode className="w-5 h-5 text-primary" />
          <span>Shop & PC QRs</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('/pricing')}
          className="h-auto py-3 flex flex-col items-center gap-1.5 border-border bg-card hover:bg-muted/50 font-mono text-xs"
        >
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <span>Page Pricing</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('/reports')}
          className="h-auto py-3 flex flex-col items-center gap-1.5 border-border bg-card hover:bg-muted/50 font-mono text-xs"
        >
          <TrendingUp className="w-5 h-5 text-primary" />
          <span>Payment Reports</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('/reminders')}
          className="h-auto py-3 flex flex-col items-center gap-1.5 border-border bg-card hover:bg-muted/50 font-mono text-xs"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span>Page Reminders</span>
        </Button>
      </div>
    </div>
  );
};

export default DashboardPage;
