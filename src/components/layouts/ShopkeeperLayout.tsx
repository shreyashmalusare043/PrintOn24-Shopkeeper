import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Printer,
  QrCode,
  Sliders,
  DollarSign,
  Users,
  MessageSquare,
  Store,
  BarChart3,
  BellRing,
  HelpCircle,
  FileText,
  ShieldCheck,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  Monitor,
  Globe,
  Sun,
  Moon,
  AlertTriangle,
  RotateCcw,
  Radio,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import type { LanguageCode } from '@/types/shopkeeper';
import { GoForPrintModal } from '@/components/modals/GoForPrintModal';

interface NavItem {
  to: string;
  labelKey?:
    | 'dashboard'
    | 'orders'
    | 'qrPc'
    | 'printers'
    | 'pricing'
    | 'memberships'
    | 'feedback'
    | 'profile'
    | 'reports'
    | 'reminders'
    | 'support'
    | 'policy'
    | 'terms'
    | 'subscription'
    | 'settings';
  label?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/orders', labelKey: 'orders', icon: FileText },
  { to: '/qr-pc', labelKey: 'qrPc', icon: QrCode },
  { to: '/printers', labelKey: 'printers', icon: Sliders },
  { to: '/pricing-config', labelKey: 'pricing', icon: DollarSign },
  { to: '/memberships', labelKey: 'memberships', icon: Users },
  { to: '/feedback', labelKey: 'feedback', icon: MessageSquare },
  { to: '/profile', labelKey: 'profile', icon: Store },
  { to: '/reports', labelKey: 'reports', icon: BarChart3 },
  { to: '/reminders', labelKey: 'reminders', icon: BellRing },
  { to: '/support', labelKey: 'support', icon: HelpCircle },
  { to: '/policy', labelKey: 'policy', icon: ShieldCheck },
  { to: '/terms', labelKey: 'terms', icon: FileText },
  { to: '/subscription', labelKey: 'subscription', icon: CreditCard },
  { to: '/settings', labelKey: 'settings', icon: Settings },
];

export const ShopkeeperLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    shop,
    pcs,
    selectedPcId,
    setSelectedPcId,
    language,
    setLanguage,
    themeMode,
    setThemeMode,
    colorTheme,
    setColorTheme,
    logout,
    t,
    reminder,
    isReminderModalOpen,
    setIsReminderModalOpen,
    activeReminderAlert,
    restartReminderCycle,
    acknowledgeReminder,
    postponeReminder,
    agentStatus,
    openGoForPrint,
  } = useShopkeeper();

  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Enforce account status guard across all protected shopkeeper routes
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.status === 'disabled' || user.status === 'inactive' || user.is_active === false) {
      logout();
      navigate('/login', {
        state: {
          accountDisabled: true,
          disabledReason:
            user.disabled_reason ||
            'Your shopkeeper account has been disabled by the Super Administrator. Access has been suspended. Please contact support or the administrator to restore your access.',
        },
      });
    }
  }, [user, navigate, logout]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const selectedPc = pcs.find((p) => p.id === selectedPcId);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ---------------- DESKTOP SIDEBAR ---------------- */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-card border-r border-border h-screen sticky top-0 overflow-y-auto">
        {/* Top Shop Brand */}
        <div className="p-4 border-b border-border flex items-center justify-between mb-[0px] mt-[0px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="https://miaoda-edit-image.s3cdn.medo.dev/eteq08019atd/IMG-ezcrheaf25mo.png"
              alt="printOn24"
              className="h-9 sm:h-[38px] max-w-[155px] object-contain shrink-0"
              data-editor-config="%7B%22defaultSrc%22%3A%22https%3A%2F%2Fmiaoda-edit-image.s3cdn.medo.dev%2Feteq08019atd%2FIMG-ezcrheaf25mo.png%22%7D" />
            <span className="text-[10px] uppercase px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30 font-sans font-semibold rounded-md shrink-0">
              Admin
            </span>
          </div>
        </div>

        {/* Live Terminal Control Access Info (SRS 2.4) */}
        <div className="p-3 bg-muted/40 border-b border-border">
          <div className="flex items-center justify-between mb-1.5 text-xs font-sans text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
              {t('controlAccess')}
            </span>
            <span className="text-primary font-bold font-mono">
              {selectedPc ? selectedPc.pc_code : 'ALL'}
            </span>
          </div>
          <select
            value={selectedPcId}
            onChange={(e) => setSelectedPcId(e.target.value)}
            className="w-full bg-card border border-border text-xs px-2.5 py-1.5 font-sans text-foreground rounded-lg focus:outline-none focus:border-primary shadow-sm"
          >
            <option value="all">{t('allPcs')}</option>
            {pcs.map((pc) => (
              <option key={pc.id} value={pc.id}>
                {pc.pc_name} ({pc.pc_code})
              </option>
            ))}
          </select>
        </div>

        {/* Navigation links - Font size increased by 1px (text-[13px]) with rounded highlight */}
        <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3 py-2 text-[13px] font-sans font-medium transition-all rounded-lg relative ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  <span className="truncate">{item.label || (item.labelKey ? t(item.labelKey) : item.to)}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/20 text-primary'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.to === '/reminders' && reminder && reminder.current_print_count >= reminder.page_threshold && (
                  <span className="ml-auto w-2 h-2 bg-destructive rounded-full animate-ping" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Bottom: Theme Palette Switcher (B2) */}
        <div className="px-4 py-2.5 border-t border-border bg-card/60 flex items-center justify-between">
          <span className="text-[12px] font-sans font-medium text-muted-foreground">Palette:</span>
          <div className="flex items-center gap-2.5">
            {/* Red Circle (Default) */}
            <button
              type="button"
              onClick={() => setColorTheme('red')}
              title="Red Theme (Default)"
              className={`w-5 h-5 rounded-full bg-red-600 transition-all flex items-center justify-center cursor-pointer ${
                colorTheme === 'red' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {colorTheme === 'red' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </button>
            {/* Blue Circle */}
            <button
              type="button"
              onClick={() => setColorTheme('blue')}
              title="Blue Theme"
              className={`w-5 h-5 rounded-full bg-blue-600 transition-all flex items-center justify-center cursor-pointer ${
                colorTheme === 'blue' ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-background scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {colorTheme === 'blue' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </button>
          </div>
        </div>

        {/* Bottom User info & quick logout */}
        <div className="p-3 border-t border-border bg-card">
          <div className="flex items-center justify-between mb-1">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-foreground truncate font-sans">
                {user?.owner_name || 'Shopkeeper'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate font-sans">
                {user?.email || ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title={t('logout')}
              className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>
      {/* ---------------- MAIN CONTENT WRAPPER ---------------- */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-card/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Drawer Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                  <Menu className="w-5 h-5 text-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-card border-r border-border flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="https://miaoda-edit-image.s3cdn.medo.dev/eteq08019atd/IMG-ezcrheaf25mo.png"
                      alt="printOn24"
                      className="h-9 max-w-[150px] object-contain shrink-0"
                    />
                    <span className="text-[10px] uppercase px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30 font-sans font-semibold rounded-md shrink-0">
                      Admin
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/40 border-b border-border">
                  <p className="text-xs font-sans text-muted-foreground uppercase mb-1">
                    {t('controlAccess')}
                  </p>
                  <select
                    value={selectedPcId}
                    onChange={(e) => {
                      setSelectedPcId(e.target.value);
                      setMobileOpen(false);
                    }}
                    className="w-full bg-card border border-border text-xs px-2 py-1.5 font-sans text-foreground rounded-lg"
                  >
                    <option value="all">{t('allPcs')}</option>
                    {pcs.map((pc) => (
                      <option key={pc.id} value={pc.id}>
                        {pc.pc_name}
                      </option>
                    ))}
                  </select>
                </div>

                <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.to;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 text-[13px] font-sans font-medium transition-all rounded-lg ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                          <span className="truncate">{item.label || (item.labelKey ? t(item.labelKey) : item.to)}</span>
                        </div>
                        {item.badge && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/20 text-primary'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>

                {/* Mobile Drawer Palette Switcher */}
                <div className="px-4 py-2 border-t border-border bg-card/60 flex items-center justify-between">
                  <span className="text-[12px] font-sans font-medium text-muted-foreground">Palette:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setColorTheme('red')}
                      className={`w-5 h-5 rounded-full bg-red-600 transition-all flex items-center justify-center ${
                        colorTheme === 'red' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : 'opacity-70'
                      }`}
                    >
                      {colorTheme === 'red' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorTheme('blue')}
                      className={`w-5 h-5 rounded-full bg-blue-600 transition-all flex items-center justify-center ${
                        colorTheme === 'blue' ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-background scale-110' : 'opacity-70'
                      }`}
                    >
                      {colorTheme === 'blue' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-sans truncate">{user?.owner_name}</span>
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-destructive font-sans rounded-lg">
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    {t('logout')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Terminal Badge */}
            {shop && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-muted border border-border text-foreground text-xs font-mono rounded-lg">
                <Store className="w-3.5 h-3.5 text-primary" />
                <span>{shop.name || 'Terminal'}</span>
                <span className="text-muted-foreground font-sans">({shop.terminal_code})</span>
              </span>
            )}
          </div>

          {/* Right Header Controls (Language, Theme, User Menu) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Page Reminder Alert Pill (Global across Shopkeeper Panel) */}
            {activeReminderAlert && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsReminderModalOpen(true)}
                className="h-8 px-2.5 text-xs font-heading font-bold flex items-center gap-1.5 animate-bounce shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {activeReminderAlert.type === 'page' ? 'Page Alert!' : 'Ink Alert!'}
                </span>
              </Button>
            )}

            {/* Language Switcher Dropdown (SRS 15: English, Marathi, Hindi) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs font-mono flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="uppercase">{language}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 font-mono text-xs">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase">
                  Select Language
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={language === 'en' ? 'bg-primary/15 text-primary font-bold' : ''}
                >
                  English
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('mr')}
                  className={language === 'mr' ? 'bg-primary/15 text-primary font-bold' : ''}
                >
                  मराठी (Marathi)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('hi')}
                  className={language === 'hi' ? 'bg-primary/15 text-primary font-bold' : ''}
                >
                  हिन्दी (Hindi)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle (SRS 14: Light / Dark Mode) */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="h-8 w-8 text-primary"
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-primary" />
              ) : (
                <Moon className="w-4 h-4 text-primary" />
              )}
            </Button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 pl-1 pr-2 flex items-center gap-1.5 font-mono text-xs">
                  <div className="w-6 h-6 border border-primary bg-primary/20 flex items-center justify-center text-primary text-[11px] font-bold">
                    {user?.owner_name?.[0] || 'R'}
                  </div>
                  <span className="hidden md:inline truncate max-w-[100px] text-foreground">
                    {user?.owner_name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 font-mono text-xs">
                <DropdownMenuLabel className="text-foreground">
                  <p className="font-bold truncate">{user?.owner_name}</p>
                  <p className="text-[10px] text-muted-foreground font-normal truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Store className="w-3.5 h-3.5 mr-2 text-primary" />
                  {t('profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-3.5 h-3.5 mr-2 text-primary" />
                  {t('settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 md:p-6 min-w-0 max-w-7xl w-full mx-auto">{children}</main>

        {/* ---------------- PAGE / INK REMINDER GLOBAL POPUP (Requirement 2) ---------------- */}
        <Dialog open={isReminderModalOpen && !!activeReminderAlert} onOpenChange={setIsReminderModalOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border font-sans rounded-xl shadow-2xl">
            <DialogHeader>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-2">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <DialogTitle className="text-base font-heading font-bold text-foreground uppercase tracking-tight flex items-center gap-2">
                <span>{activeReminderAlert?.type === 'page' ? 'Page Reminder' : 'Ink Reminder'}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                {activeReminderAlert?.type === 'page'
                  ? 'Configured page capacity threshold has been reached or exceeded for this printer.'
                  : 'Configured ink reminder threshold has been reached or exceeded for this printer.'}
              </DialogDescription>
            </DialogHeader>

            {activeReminderAlert && (
              <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Printer Name:</span>
                  <strong className="text-foreground font-semibold">{activeReminderAlert.printerName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Current Page Count:</span>
                  <strong className="text-destructive font-mono font-bold text-sm">
                    {activeReminderAlert.currentCount.toLocaleString()} pages
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Configured Reminder Threshold:</span>
                  <strong className="text-foreground font-mono font-semibold">
                    {activeReminderAlert.threshold.toLocaleString()} pages
                  </strong>
                </div>

                <div className="w-full bg-muted h-2.5 rounded-full border border-border overflow-hidden">
                  <div
                    className="bg-destructive h-full transition-all"
                    style={{
                      width: `${Math.min(100, (activeReminderAlert.currentCount / activeReminderAlert.threshold) * 100)}%`,
                    }}
                  />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Click <strong>Cycle Restart</strong> to reset this printer&apos;s cycle count back to 0 and begin a new tracking cycle.
                </p>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsReminderModalOpen(false)}
                className="w-full sm:w-auto text-xs font-semibold rounded-lg"
              >
                Dismiss for Now
              </Button>
              <Button
                variant="default"
                onClick={() => restartReminderCycle()}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold text-xs rounded-lg gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cycle Restart</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Real Hardware Go For Print Execution Modal (Global) */}
        <GoForPrintModal />
      </div>
    </div>
  );
};

export default ShopkeeperLayout;
