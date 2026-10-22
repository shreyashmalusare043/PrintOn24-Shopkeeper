import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ShopkeeperUser,
  ShopProfile,
  ShopPC,
  ShopPrinter,
  PrintOrder,
  LanguageCode,
  ThemeMode,
  ColorTheme,
  ShopReminder,
  PageReminder,
  ShopSubscription,
} from '@/types/shopkeeper';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { localPrintAgent, type AgentStatus } from '@/services/localPrintAgent';
import { getTranslation, translations } from '@/lib/i18n';
import { toast } from 'sonner';

export interface ActiveAlertInfo {
  printerId: string;
  reminderId: string;
  printerName: string;
  type: 'page' | 'ink';
  currentCount: number;
  threshold: number;
}

interface ShopkeeperContextType {
  user: ShopkeeperUser | null;
  shop: ShopProfile | null;
  pcs: ShopPC[];
  selectedPcId: string; // 'all' or specific PC ID
  setSelectedPcId: (id: string) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  toggleTheme: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  themeColor: ColorTheme;
  setThemeColor: (theme: ColorTheme) => void;
  reminder: ShopReminder | null;
  reminders: PageReminder[];
  subscription: ShopSubscription | null;
  isReminderModalOpen: boolean;
  setIsReminderModalOpen: (open: boolean) => void;
  activeReminderAlert: ActiveAlertInfo | null;
  restartReminderCycle: (targetAlert?: ActiveAlertInfo) => Promise<void>;
  acknowledgeReminder: () => Promise<void>;
  postponeReminder: () => Promise<void>;
  triggerRemindMeLater: () => Promise<void>;
  login: (
    email: string,
    pass: string,
    rememberDevice?: boolean
  ) => Promise<{
    success: boolean;
    error?: string;
    isNewDevice?: boolean;
    qzAuthWarning?: string;
    user?: ShopkeeperUser;
  }>;
  logout: () => void;
  refreshShopData: () => Promise<void>;
  t: (key: keyof typeof translations['en']) => string;
  playOrderNotificationSound: () => void;

  // Real-Time Hardware & "Go For Print" additions
  agentStatus: AgentStatus;
  realPrinters: ShopPrinter[];
  refreshPrinters: (pcId?: string) => Promise<void>;
  refreshPcs: () => Promise<void>;
  isGoForPrintOpen: boolean;
  setIsGoForPrintOpen: (open: boolean) => void;
  targetPrintOrder: PrintOrder | null;
  openGoForPrint: (order?: PrintOrder) => void;
}

const ShopkeeperContext = createContext<ShopkeeperContextType | null>(null);

export const ShopkeeperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ShopkeeperUser | null>(() => shopkeeperApi.getCurrentUser());
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [pcs, setPcs] = useState<ShopPC[]>([]);
  const [selectedPcId, setSelectedPcId] = useState<string>('all');
  const [realPrinters, setRealPrinters] = useState<ShopPrinter[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(localPrintAgent.getStatus());

  // Go For Print Modal State
  const [isGoForPrintOpen, setIsGoForPrintOpen] = useState(false);
  const [targetPrintOrder, setTargetPrintOrder] = useState<PrintOrder | null>(null);
  
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    return (localStorage.getItem('copygo_lang') as LanguageCode) || 'en';
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('copygo_theme_mode') as ThemeMode) || 'dark';
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    return (localStorage.getItem('copygo_color_theme') as ColorTheme) || 'red';
  });

  const [reminder, setReminder] = useState<ShopReminder | null>(null);
  const [remindersList, setRemindersList] = useState<PageReminder[]>([]);
  const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [activeReminderAlert, setActiveReminderAlert] = useState<ActiveAlertInfo | null>(null);

  // Subscribe to local print bridge agent status
  useEffect(() => {
    const unsub = localPrintAgent.subscribeStatus((st) => {
      setAgentStatus(st);
    });
    return unsub;
  }, []);

  // Set theme attributes on HTML root
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = themeMode;
    localStorage.setItem('copygo_theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', colorTheme);
    localStorage.setItem('copygo_color_theme', colorTheme);
  }, [colorTheme]);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('copygo_lang', lang);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
  };

  const t = useCallback(
    (key: keyof typeof translations['en']) => {
      return getTranslation(language, key);
    },
    [language]
  );

  const refreshPrinters = useCallback(async (pcId?: string) => {
    if (!user?.shop_id) return;
    try {
      const activePcId = selectedPcId === 'all' ? undefined : selectedPcId;
      const currentPcId =
        pcId || activePcId || pcs.find((pc) => pc.is_current_pc)?.id || pcs[0]?.id;

      if (currentPcId) {
        await shopkeeperApi.syncDetectedPrinters(user.shop_id, currentPcId);
      }

      const printers = await shopkeeperApi.getShopPrinters(user.shop_id, activePcId);
      setRealPrinters(printers);
    } catch (err) {
      console.error('Failed to refresh printers:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to refresh printers');
    }
  }, [user?.shop_id, selectedPcId, pcs]);

  const refreshPcs = useCallback(async () => {
    if (!user?.shop_id) return;
    try {
      const pcList = await shopkeeperApi.getShopPCs(user.shop_id);
      setPcs(pcList);
    } catch (err) {
      console.error('Failed to refresh PCs:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load PC terminals');
    }
  }, [user?.shop_id]);

  // Fetch shop details and devices
  const refreshShopData = useCallback(async () => {
    if (!user?.shop_id) return;
    try {
      // Security Enforcement: Verify account status with database (Super Admin Account Disable/Enable Security)
      const statusCheck = await shopkeeperApi.verifyAccountStatus(user.shop_id, user.id);
      if (!statusCheck.active) {
        shopkeeperApi.logout();
        setUser(null);
        toast.error(
          statusCheck.reason ||
            'Your shopkeeper account has been disabled by the Super Administrator. Access has been suspended. Please contact support or the administrator to restore your access.',
          { duration: 10000 }
        );
        window.location.href = '/login';
        return;
      }

      const [shopData, pcList, reminderList, sub] = await Promise.all([
        shopkeeperApi.getShopProfile(user.shop_id),
        shopkeeperApi.getShopPCs(user.shop_id).catch((err) => {
          console.error('Failed to load PC terminals:', err);
          toast.error(err instanceof Error ? err.message : 'Failed to load PC terminals');
          return [];
        }),
        shopkeeperApi.getReminders(user.shop_id),
        shopkeeperApi.getShopSubscription(user.shop_id),
      ]);

      if (shopData) setShop(shopData);
      if (pcList) setPcs(pcList);
      if (reminderList) setRemindersList(reminderList);
      if (sub) setSubscription(sub);

      const currentPcId = pcList.find((pc) => pc.is_current_pc)?.id || pcList[0]?.id;
      await refreshPrinters(currentPcId);

      // Check real printer reminders for global popup alert (Page Reminder / Ink Reminder)
      try {
        const prnReminders = await shopkeeperApi.getPrinterReminders(user.shop_id);
        let foundAlert: ActiveAlertInfo | null = null;
        for (const pr of prnReminders) {
          const pageThreshold = pr.page_threshold || 1800;
          const currentCount = pr.current_print_count ?? pr.bw_printed_count ?? 0;
          if (currentCount >= pageThreshold && pageThreshold > 0) {
            foundAlert = {
              printerId: pr.printer_id || pr.id,
              reminderId: pr.id,
              printerName: pr.printer_name,
              type: 'page',
              currentCount: currentCount,
              threshold: pageThreshold,
            };
            break;
          }
          const isColorPrn = pr.is_color ?? (pr.print_mode === 'color' || pr.print_mode === 'both');
          const inkThreshold = pr.color_threshold || 1500;
          const inkCount = pr.color_printed_count ?? 0;
          if (isColorPrn && inkCount >= inkThreshold && inkThreshold > 0) {
            foundAlert = {
              printerId: pr.printer_id || pr.id,
              reminderId: pr.id,
              printerName: pr.printer_name,
              type: 'ink',
              currentCount: inkCount,
              threshold: inkThreshold,
            };
            break;
          }
        }

        if (foundAlert) {
          setActiveReminderAlert(foundAlert);
          setIsReminderModalOpen(true);
        } else {
          setActiveReminderAlert(null);
        }
      } catch (e) {
        console.warn('Error checking printer reminders:', e);
      }
    } catch (err) {
      console.error('Error refreshing shop data:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to refresh shop data');
    }
  }, [user, refreshPrinters]);

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    if (!user?.shop_id) return;

    const unsubPcs = shopkeeperApi.subscribeToPcs(user.shop_id, () => {
      refreshPcs();
    });

    const unsubPrinters = shopkeeperApi.subscribeToPrinters(user.shop_id, () => {
      refreshPrinters();
    });

    // Workstation Heartbeat beacon loop (every 10s)
    const heartbeatInterval = setInterval(() => {
      const currentPc = pcs.find((p) => p.is_current_pc) || pcs[0];
      if (currentPc) {
        shopkeeperApi.updatePcHeartbeat(currentPc.id);
      }
    }, 10000);

    return () => {
      unsubPcs.unsubscribe();
      unsubPrinters.unsubscribe();
      clearInterval(heartbeatInterval);
    };
  }, [user?.shop_id, refreshPcs, refreshPrinters, pcs]);

  const openGoForPrint = useCallback((order?: PrintOrder) => {
    setTargetPrintOrder(order || null);
    setIsGoForPrintOpen(true);
  }, []);

  useEffect(() => {
    refreshShopData();
  }, [refreshShopData]);

  // Audio notification for incoming print orders
  const playOrderNotificationSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio autoplay restrictions fallback
    }
  }, []);

  const acknowledgeReminder = async () => {
    if (activeReminderAlert) {
      await restartReminderCycle(activeReminderAlert);
      return;
    }
    if (remindersList.length > 0) {
      await shopkeeperApi.updateReminderThreshold(remindersList[0].id, remindersList[0].threshold_pages + 2000);
      toast.success('Print page counter reset for next threshold!');
    }
    setIsReminderModalOpen(false);
    refreshShopData();
  };

  const restartReminderCycle = async (targetAlert?: ActiveAlertInfo) => {
    const alertToReset = targetAlert || activeReminderAlert;
    if (!alertToReset || !user?.shop_id) {
      setIsReminderModalOpen(false);
      return;
    }
    const counterType = alertToReset.type === 'page' ? 'bw' : 'color';
    await shopkeeperApi.resetPrinterReminderCycle(
      user.shop_id,
      alertToReset.reminderId,
      alertToReset.printerName,
      counterType,
      alertToReset.currentCount,
      `Cycle restarted from global reminder popup (${alertToReset.type.toUpperCase()}) at ${alertToReset.currentCount} pages`
    );
    toast.success(`Cycle restarted for "${alertToReset.printerName}"! Counter reset to 0 pages.`);
    setActiveReminderAlert(null);
    setIsReminderModalOpen(false);
    await refreshShopData();
  };

  const postponeReminder = async () => {
    setIsReminderModalOpen(false);
    toast.info('Reminder postponed. Alert will show again in 50 prints.');
  };

  const triggerRemindMeLater = postponeReminder;

  const login = async (email: string, pass: string, rememberDevice = true) => {
    const res = await shopkeeperApi.login(email, pass, rememberDevice);
    if (res.success && res.user) {
      setUser(res.user);
      await refreshShopData();
    }
    return res;
  };

  const logout = async () => {
    await shopkeeperApi.logout();
    setUser(null);
    setShop(null);
  };

  const selectedPc = useMemo(() => {
    if (selectedPcId === 'all') return null;
    return pcs.find((p) => p.id === selectedPcId) || null;
  }, [pcs, selectedPcId]);

  const value = useMemo(
    () => ({
      user,
      shop,
      pcs,
      selectedPcId,
      setSelectedPcId,
      selectedPc,
      language,
      setLanguage,
      themeMode,
      setThemeMode,
      isDark: themeMode === 'dark',
      toggleTheme,
      colorTheme,
      setColorTheme,
      themeColor: colorTheme,
      setThemeColor: setColorTheme,
      reminder,
      reminders: remindersList,
      subscription,
      isReminderModalOpen,
      setIsReminderModalOpen,
      activeReminderAlert,
      restartReminderCycle,
      acknowledgeReminder,
      postponeReminder,
      triggerRemindMeLater,
      login,
      logout,
      refreshShopData,
      t,
      playOrderNotificationSound,

      // Real-Time Hardware & "Go For Print" additions
      agentStatus,
      realPrinters,
      refreshPrinters,
      refreshPcs,
      isGoForPrintOpen,
      setIsGoForPrintOpen,
      targetPrintOrder,
      openGoForPrint,
    }),
    [
      user,
      shop,
      pcs,
      selectedPcId,
      selectedPc,
      language,
      themeMode,
      colorTheme,
      reminder,
      remindersList,
      subscription,
      isReminderModalOpen,
      refreshShopData,
      t,
      playOrderNotificationSound,
      agentStatus,
      realPrinters,
      refreshPrinters,
      refreshPcs,
      isGoForPrintOpen,
      targetPrintOrder,
      openGoForPrint,
    ]
  );

  return <ShopkeeperContext.Provider value={value}>{children}</ShopkeeperContext.Provider>;
};

export const useShopkeeper = () => {
  const context = useContext(ShopkeeperContext);
  if (!context) {
    throw new Error('useShopkeeper must be used within a ShopkeeperProvider');
  }
  return context;
};
