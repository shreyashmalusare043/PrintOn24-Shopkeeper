import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { ColorTheme } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SixDigitOtpInput } from '@/components/SixDigitOtpInput';
import {
  Settings,
  Sun,
  Moon,
  Palette,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RotateCcw,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  BarChart3,
  Printer,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const { user, isDark, toggleTheme, refreshShopData } =
    useShopkeeper();

  // Security modals & OTP state
  const [securityAction, setSecurityAction] = useState<
    'password' | 'email' | 'phone' | 'reports_password' | 'printers_password' | null
  >(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [maskedEmailNotice, setMaskedEmailNotice] = useState('');

  // 60-second cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Administrative Password fields (Items 6, 7, 8)
  const [oldPassword, setOldPassword] = useState('');
  const [oldPasswordState, setOldPasswordState] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [oldPasswordError, setOldPasswordError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email & Phone fields
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Report & Analytics Password state (Items 9 & 10)
  const [reportsPasswordConfigured, setReportsPasswordConfigured] = useState<boolean>(false);
  const [reportsPasscodeModalOpen, setReportsPasscodeModalOpen] = useState(false);
  const [reportsNewPasscode, setReportsNewPasscode] = useState('');
  const [reportsPasscodeError, setReportsPasscodeError] = useState<string | null>(null);

  // Print Configuration Password state (Item 11)
  const [printersPasswordConfigured, setPrintersPasswordConfigured] = useState<boolean>(false);
  const [printersPasscodeModalOpen, setPrintersPasscodeModalOpen] = useState(false);
  const [printersNewPasscode, setPrintersNewPasscode] = useState('');
  const [printersPasscodeError, setPrintersPasscodeError] = useState<string | null>(null);

  // Login Password Verification for 6-Digit Passcode Setup / Change (Replaces OTP)
  const [loginVerifyModalOpen, setLoginVerifyModalOpen] = useState(false);
  const [loginVerifyAction, setLoginVerifyAction] = useState<'reports_password' | 'printers_password' | null>(null);
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginPasswordError, setLoginPasswordError] = useState<string | null>(null);
  const [verifyingLoginPassword, setVerifyingLoginPassword] = useState(false);
  const [securityAuthToken, setSecurityAuthToken] = useState<string | null>(null);

  // Load passcode status on mount
  useEffect(() => {
    if (!user?.shop_id) return;
    const checkPasscodeStatus = async () => {
      const [hasRep, hasPrint] = await Promise.all([
        shopkeeperApi.isReportsPasswordConfigured(user.shop_id),
        shopkeeperApi.isPrintersPasswordConfigured(user.shop_id),
      ]);
      setReportsPasswordConfigured(hasRep);
      setPrintersPasswordConfigured(hasPrint);
    };
    checkPasscodeStatus();
  }, [user?.shop_id]);

  // Item 6: Verify Old Password securely against authentication system
  const handleVerifyOldPassword = async () => {
    if (!oldPassword) {
      setOldPasswordState('invalid');
      setOldPasswordError('Please enter your current password.');
      return;
    }
    if (!user?.shop_id) return;

    setOldPasswordState('verifying');
    setOldPasswordError('');

    try {
      const isValid = await shopkeeperApi.verifyOldPassword(user.shop_id, oldPassword);
      if (isValid) {
        setOldPasswordState('valid');
        setOldPasswordError('');
        toast.success('Old password verified successfully.');
      } else {
        setOldPasswordState('invalid');
        setOldPasswordError('Invalid old password. Please enter your correct current password.');
        toast.error('Old password verification failed.');
      }
    } catch {
      setOldPasswordState('invalid');
      setOldPasswordError('Failed to verify password. Please try again.');
    }
  };

  // Resend OTP handler with rate-limit and 60-second cooldown
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !user?.shop_id || !securityAction) return;
    const purposeMap: Record<string, 'account_password' | 'reports_password' | 'printers_password' | 'email' | 'phone'> = {
      password: 'account_password',
      reports_password: 'reports_password',
      printers_password: 'printers_password',
      email: 'email',
      phone: 'phone',
    };
    const purpose = purposeMap[securityAction] || 'account_password';
    const res = await shopkeeperApi.sendSecureOtp(user.shop_id, user.email, purpose);
    if (res.success) {
      setResendCooldown(res.cooldownSeconds || 60);
      setMaskedEmailNotice(res.maskedEmail);
      setOtpError(null);
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  // Item 6 & 7: Initiate Password Change with real DB-backed OTP
  const handleInitiatePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPasswordState !== 'valid') {
      toast.error('Please verify your current password before proceeding.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (!user?.shop_id) return;

    setSecurityAction('password');
    setOtpCode('');
    setOtpError(null);

    const res = await shopkeeperApi.sendSecureOtp(user.shop_id, user.email, 'account_password');
    if (res.success) {
      setResendCooldown(res.cooldownSeconds || 60);
      setMaskedEmailNotice(res.maskedEmail);
      setOtpModalOpen(true);
      toast.info(res.message);
    } else {
      toast.error(res.message);
    }
  };

  // Initiate Report & Analytics password update (verifies Login Password first, NO OTP)
  const handleInitiateReportsPasswordChange = () => {
    if (!user?.shop_id) return;
    setLoginVerifyAction('reports_password');
    setLoginPasswordInput('');
    setLoginPasswordError(null);
    setShowLoginPassword(false);
    setLoginVerifyModalOpen(true);
  };

  // Initiate Print Configuration password update (verifies Login Password first, NO OTP)
  const handleInitiatePrintersPasswordChange = () => {
    if (!user?.shop_id) return;
    setLoginVerifyAction('printers_password');
    setLoginPasswordInput('');
    setLoginPasswordError(null);
    setShowLoginPassword(false);
    setLoginVerifyModalOpen(true);
  };

  // Handle Login Password Verification Submission
  const handleVerifyLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPasswordInput) {
      setLoginPasswordError('Please enter your account login password.');
      return;
    }
    if (!user?.shop_id || !loginVerifyAction) return;

    setVerifyingLoginPassword(true);
    setLoginPasswordError(null);
    try {
      const res = await shopkeeperApi.verifyLoginPasswordForSecurityAction(
        user.shop_id,
        loginPasswordInput,
        loginVerifyAction
      );

      if (res.success && res.token) {
        setSecurityAuthToken(res.token);
        setLoginVerifyModalOpen(false);
        setLoginPasswordInput('');
        toast.success('Identity verified. Please configure your 6-digit password.');

        if (loginVerifyAction === 'reports_password') {
          setReportsNewPasscode('');
          setReportsPasscodeError(null);
          setReportsPasscodeModalOpen(true);
        } else if (loginVerifyAction === 'printers_password') {
          setPrintersNewPasscode('');
          setPrintersPasscodeError(null);
          setPrintersPasscodeModalOpen(true);
        }
      } else {
        setLoginPasswordError(res.message || 'Incorrect account login password. Please try again.');
      }
    } catch {
      setLoginPasswordError('Authentication failed. Please verify your password and try again.');
    } finally {
      setVerifyingLoginPassword(false);
    }
  };

  const handleInitiateEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!user?.shop_id) return;

    setSecurityAction('email');
    setOtpCode('');
    setOtpError(null);
    const res = await shopkeeperApi.sendSecureOtp(user.shop_id, user.email, 'email');
    if (res.success) {
      setResendCooldown(res.cooldownSeconds || 60);
      setMaskedEmailNotice(res.maskedEmail);
      setOtpModalOpen(true);
      toast.info(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleInitiatePhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || newPhone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!user?.shop_id) return;

    setSecurityAction('phone');
    setOtpCode('');
    setOtpError(null);
    const res = await shopkeeperApi.sendSecureOtp(user.shop_id, user.email, 'phone');
    if (res.success) {
      setResendCooldown(res.cooldownSeconds || 60);
      setMaskedEmailNotice(res.maskedEmail);
      setOtpModalOpen(true);
      toast.info(res.message);
    } else {
      toast.error(res.message);
    }
  };

  // Verify OTP and proceed with requested action (Item 7 & 8)
  const handleVerifyOtpAndCommit = async () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter all 6 digits of the OTP.');
      return;
    }
    if (!user?.shop_id) return;

    setSavingCredentials(true);
    setOtpError(null);

    try {
      if (securityAction === 'password') {
        const res = await shopkeeperApi.changeAccountPasswordWithOtp(
          user.shop_id,
          user.email,
          otpCode,
          newPassword
        );
        if (res.success) {
          toast.success(res.message);
          setOldPassword('');
          setOldPasswordState('idle');
          setNewPassword('');
          setConfirmPassword('');
          setOtpModalOpen(false);
        } else {
          setOtpError(res.message);
          toast.error(res.message);
        }
      } else if (securityAction === 'reports_password') {
        const res = await shopkeeperApi.verifySecureOtp(user.shop_id, 'reports_password', otpCode);
        if (res.success) {
          setOtpModalOpen(false);
          setReportsNewPasscode('');
          setReportsPasscodeError(null);
          setReportsPasscodeModalOpen(true);
        } else {
          setOtpError(res.message);
          toast.error(res.message);
        }
      } else if (securityAction === 'printers_password') {
        const res = await shopkeeperApi.verifySecureOtp(user.shop_id, 'printers_password', otpCode);
        if (res.success) {
          setOtpModalOpen(false);
          setPrintersNewPasscode('');
          setPrintersPasscodeError(null);
          setPrintersPasscodeModalOpen(true);
        } else {
          setOtpError(res.message);
          toast.error(res.message);
        }
      } else if (securityAction === 'email') {
        const verification = await shopkeeperApi.verifySecureOtp(user.shop_id, 'email', otpCode);
        if (!verification.success) {
          setOtpError(verification.message);
          toast.error(verification.message);
          return;
        }
        const success = await shopkeeperApi.updateShopkeeperEmail(user.shop_id, newEmail);
        if (success) {
          toast.success(`Primary account email updated to ${newEmail}!`);
          setNewEmail('');
          await refreshShopData();
          setOtpModalOpen(false);
        } else {
          toast.error('Failed to update email');
        }
      } else if (securityAction === 'phone') {
        const verification = await shopkeeperApi.verifySecureOtp(user.shop_id, 'phone', otpCode);
        if (!verification.success) {
          setOtpError(verification.message);
          toast.error(verification.message);
          return;
        }
        const success = await shopkeeperApi.updateShopkeeperPhone(user.shop_id, newPhone);
        if (success) {
          toast.success(`Contact phone updated to ${newPhone}!`);
          setNewPhone('');
          await refreshShopData();
          setOtpModalOpen(false);
        } else {
          toast.error('Failed to update phone');
        }
      }
    } finally {
      setSavingCredentials(false);
    }
  };

  // Save Report & Analytics Passcode (Item 9)
  const handleSaveReportsPasscode = async () => {
    if (reportsNewPasscode.length !== 6) {
      setReportsPasscodeError('Passcode must be exactly 6 numeric digits.');
      return;
    }
    if (shopkeeperApi.isWeakPassword(reportsNewPasscode)) {
      setReportsPasscodeError(
        'Weak password rejected. Do not use sequential or repeated digits (e.g. 123456, 000000, 111111).'
      );
      return;
    }
    if (!user?.shop_id) return;

    const res = await shopkeeperApi.updateReportsPassword(
      user.shop_id,
      reportsNewPasscode,
      securityAuthToken || undefined
    );
    if (res.success) {
      toast.success(res.message || 'Report & Analytics 6-digit password configured securely!');
      setReportsPasswordConfigured(true);
      setReportsPasscodeModalOpen(false);
      setReportsNewPasscode('');
      setSecurityAuthToken(null);
    } else {
      setReportsPasscodeError(res.message || 'Failed to save Report & Analytics password.');
      toast.error(res.message || 'Failed to save Report & Analytics password.');
    }
  };

  // Save Print Configuration Passcode (Item 11)
  const handleSavePrintersPasscode = async () => {
    if (printersNewPasscode.length !== 6) {
      setPrintersPasscodeError('Passcode must be exactly 6 numeric digits.');
      return;
    }
    if (shopkeeperApi.isWeakPassword(printersNewPasscode)) {
      setPrintersPasscodeError(
        'Weak password rejected. Do not use sequential or repeated digits (e.g. 123456, 000000, 111111).'
      );
      return;
    }
    if (!user?.shop_id) return;

    const res = await shopkeeperApi.updatePrintersPassword(
      user.shop_id,
      printersNewPasscode,
      securityAuthToken || undefined
    );
    if (res.success) {
      toast.success(res.message || 'Print Configuration 6-digit password configured securely!');
      setPrintersPasswordConfigured(true);
      setPrintersPasscodeModalOpen(false);
      setPrintersNewPasscode('');
      setSecurityAuthToken(null);
    } else {
      setPrintersPasscodeError(res.message || 'Failed to save Print Configuration password.');
      toast.error(res.message || 'Failed to save Print Configuration password.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs font-mono uppercase text-muted-foreground">Configuration & Security</span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Application Settings
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Configure display mode, theme preferences, and manage administrative credentials with email OTP verification.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* App Layout & Appearance Settings */}
        <Card className="bg-card border-border rounded-xl">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Interface Theme &amp; Display Mode
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Select your preferred display mode. The application operates with the standardized Red &amp; Blue brand palette.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-6 text-xs font-sans">
            {/* Light / Dark Mode Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
              <div>
                <Label className="text-xs font-bold text-foreground uppercase">Display Theme Mode</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Currently running in {isDark ? 'Dark Mode (Industrial HUD)' : 'Light Mode (Clean Workshop)'}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="h-8 text-xs rounded-lg font-semibold"
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                    Switch to Light
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Switch to Dark
                  </>
                )}
              </Button>
            </div>

            {/* Standard Red & Blue Color Palette Guarantee */}
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span className="w-3 h-3 rounded-full bg-blue-600" />
                <Label className="text-xs font-bold text-foreground uppercase">Color Theme System</Label>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans">
                Standardized Red &amp; Blue industrial palette locked across the application.
              </p>
              <Badge variant="outline" className="text-[10px] font-mono mt-1 border-primary text-primary">
                Red &amp; Blue Palette (Active)
              </Badge>
            </div>

            {/* Language Setting - English Only */}
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-1">
              <Label className="text-xs font-bold text-foreground uppercase">Application Language</Label>
              <p className="text-[11px] text-muted-foreground">
                printOn24 Shopkeeper Admin Panel is strictly operating in standard English for consistent terminology and hardware integration.
              </p>
              <Badge variant="outline" className="text-[10px] font-mono mt-1 border-primary text-primary">
                English (Default)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security & Authentication Credentials (Item 6 & 7) */}
        <Card className="bg-card border-border rounded-xl">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Administrative Security Credentials
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Update password, registered email, and contact mobile with database persistence.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-6 text-xs font-sans">
            {/* Current Registered Info Summary */}
            <div className="p-3 bg-muted/40 border border-border rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Active Account Email</span>
                <span className="font-mono text-foreground font-semibold truncate block mt-0.5">{user?.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Active Mobile Number</span>
                <span className="font-mono text-foreground font-semibold truncate block mt-0.5">{user?.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Change Password Form (Item 6) */}
            <form onSubmit={handleInitiatePasswordChange} className="space-y-3 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-heading font-bold text-foreground uppercase text-xs">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Change Administrative Password</span>
                </div>
                {oldPasswordState === 'valid' && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] gap-1">
                    <Check className="w-3 h-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Old Password Verification Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Old Password *</Label>
                  <span className="text-[10px] text-muted-foreground">Required to unlock change</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value);
                        if (oldPasswordState !== 'idle') {
                          setOldPasswordState('idle');
                          setOldPasswordError('');
                        }
                      }}
                      placeholder="Enter current password"
                      required
                      className={`text-xs rounded-lg h-8 transition-colors ${
                        oldPasswordState === 'valid'
                          ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/5'
                          : oldPasswordState === 'invalid'
                          ? 'border-destructive ring-1 ring-destructive bg-destructive/5'
                          : ''
                      }`}
                    />
                    {oldPasswordState === 'valid' && (
                      <Check className="w-4 h-4 text-emerald-500 absolute right-2.5 top-2" />
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={oldPasswordState === 'valid' ? 'secondary' : 'default'}
                    disabled={!oldPassword || oldPasswordState === 'verifying' || oldPasswordState === 'valid'}
                    onClick={handleVerifyOldPassword}
                    className="h-8 text-xs font-semibold rounded-lg px-3 shrink-0"
                  >
                    {oldPasswordState === 'verifying' ? 'Verifying...' : oldPasswordState === 'valid' ? 'Verified' : 'Verify'}
                  </Button>
                </div>
                {oldPasswordState === 'invalid' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{oldPasswordError || 'Invalid old password. Please enter your correct current password.'}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">New Password *</Label>
                  <Input
                    type="password"
                    disabled={oldPasswordState !== 'valid'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    className="text-xs rounded-lg h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Confirm New Password *</Label>
                  <Input
                    type="password"
                    disabled={oldPasswordState !== 'valid'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="text-xs rounded-lg h-8"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={oldPasswordState !== 'valid' || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                variant="outline"
                size="sm"
                className="text-xs h-8 rounded-lg font-semibold"
              >
                Update Password via OTP
              </Button>
            </form>

            {/* Update Email Form */}
            <form onSubmit={handleInitiateEmailChange} className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 font-heading font-bold text-foreground uppercase text-xs">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>Update Account Email</span>
              </div>

              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  required
                  className="text-xs rounded-lg h-8"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-lg shrink-0 font-semibold"
                >
                  Verify & Update
                </Button>
              </div>
            </form>

            {/* Update Mobile Number Form */}
            <form onSubmit={handleInitiatePhoneChange} className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 font-heading font-bold text-foreground uppercase text-xs">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>Update Mobile Number</span>
              </div>

              <div className="flex gap-2">
                <Input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                  className="text-xs rounded-lg h-8 font-mono"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-lg shrink-0 font-semibold"
                >
                  Verify & Update
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Dedicated Section Protection Passwords (Items 9 & 11) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report & Analytics Password Setting (Item 9) */}
        <Card className="bg-card border-border rounded-xl">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span>Report & Analytics Password</span>
              </CardTitle>
              <Badge
                variant={reportsPasswordConfigured ? 'default' : 'secondary'}
                className="text-[10px] uppercase font-mono"
              >
                {reportsPasswordConfigured ? 'Configured (Locked)' : 'Not Set (Direct Access)'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Separate 6-digit numeric password to protect confidential financial and print volume analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4 text-xs font-sans">
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Protection Status:</span>
                <span className="font-semibold text-foreground">
                  {reportsPasswordConfigured ? '•••••• (Protected by 6-digit Passcode)' : 'Open (No Passcode)'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When enabled, the Report &amp; Analytics page will display a blurred security overlay until unlocked with this passcode.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInitiateReportsPasswordChange}
              className="text-xs h-8 rounded-lg font-semibold gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              <span>{reportsPasswordConfigured ? 'Update 6-Digit Password' : 'Set 6-Digit Password'}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Print Configuration Password Setting (Item 11) */}
        <Card className="bg-card border-border rounded-xl">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary" />
                <span>Print Configuration Password</span>
              </CardTitle>
              <Badge
                variant={printersPasswordConfigured ? 'default' : 'secondary'}
                className="text-[10px] uppercase font-mono"
              >
                {printersPasswordConfigured ? 'Configured (Locked)' : 'Not Set (Direct Access)'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Separate 6-digit numeric password to prevent unauthorized adjustments to hardware printers & routing.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4 text-xs font-sans">
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Protection Status:</span>
                <span className="font-semibold text-foreground">
                  {printersPasswordConfigured ? '•••••• (Protected by 6-digit Passcode)' : 'Open (No Passcode)'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When enabled, the Print Configuration page will display a blurred security overlay until unlocked with this passcode.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInitiatePrintersPasswordChange}
              className="text-xs h-8 rounded-lg font-semibold gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              <span>{printersPasswordConfigured ? 'Update 6-Digit Password' : 'Set 6-Digit Password'}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Six-Digit OTP Verification Modal (Item 8) */}
      <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Two-Factor Security Verification
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Enter the 6-digit verification code sent to your registered email to confirm this action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs font-sans">
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
              <div className="text-muted-foreground">
                Action:{' '}
                <strong className="text-foreground uppercase">
                  {securityAction === 'password'
                    ? 'Administrative Password Update'
                    : securityAction === 'reports_password'
                    ? 'Report & Analytics Password Configuration'
                    : securityAction === 'printers_password'
                    ? 'Print Configuration Password Configuration'
                    : `${securityAction} Update`}
                </strong>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Dispatched to:{' '}
                <strong className="text-foreground font-mono">
                  {maskedEmailNotice || shopkeeperApi.maskEmail(user?.email || '')}
                </strong>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                <Clock className="w-3 h-3 text-primary" />
                <span>Code valid for 10 minutes (single-use, max 5 attempts).</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground uppercase text-center block">
                Enter 6-Digit Verification Code
              </Label>
              <SixDigitOtpInput
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val);
                  if (otpError) setOtpError(null);
                }}
                error={otpError}
                disabled={savingCredentials}
              />
            </div>

            {/* Resend OTP with 60s cooldown */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
              <span className="text-muted-foreground text-[11px]">Didn&apos;t receive code?</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0 || savingCredentials}
                onClick={handleResendOtp}
                className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 rounded-md gap-1"
              >
                <RotateCcw className={`w-3 h-3 ${resendCooldown > 0 ? '' : 'text-primary'}`} />
                <span>{resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}</span>
              </Button>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOtpModalOpen(false)}
              className="text-xs h-8 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleVerifyOtpAndCommit}
              disabled={savingCredentials || otpCode.length !== 6}
              className="bg-primary text-primary-foreground text-xs h-8 rounded-lg font-semibold"
            >
              {savingCredentials ? 'Verifying...' : 'Verify Code & Proceed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Report & Analytics 6-Digit Passcode Modal (Item 9) */}
      <Dialog open={reportsPasscodeModalOpen} onOpenChange={setReportsPasscodeModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Configure Report & Analytics Password</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Enter a secure 6-digit numeric password. Predictable combinations (123456, 000000, 111111) are rejected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs font-sans">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground uppercase text-center block">
                Enter New 6-Digit Numeric Passcode
              </Label>
              <SixDigitOtpInput
                value={reportsNewPasscode}
                onChange={(val) => {
                  setReportsNewPasscode(val);
                  if (reportsPasscodeError) setReportsPasscodeError(null);
                }}
                error={reportsPasscodeError}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportsPasscodeModalOpen(false)}
              className="text-xs h-8 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveReportsPasscode}
              disabled={reportsNewPasscode.length !== 6}
              className="bg-primary text-primary-foreground text-xs h-8 rounded-lg font-semibold"
            >
              Save Passcode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Print Configuration 6-Digit Passcode Modal (Item 11) */}
      <Dialog open={printersPasscodeModalOpen} onOpenChange={setPrintersPasscodeModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <span>Configure Print Configuration Password</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Enter a secure 6-digit numeric password. Predictable combinations (123456, 000000, 111111) are rejected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs font-sans">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground uppercase text-center block">
                Enter New 6-Digit Numeric Passcode
              </Label>
              <SixDigitOtpInput
                value={printersNewPasscode}
                onChange={(val) => {
                  setPrintersNewPasscode(val);
                  if (printersPasscodeError) setPrintersPasscodeError(null);
                }}
                error={printersPasscodeError}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintersPasscodeModalOpen(false)}
              className="text-xs h-8 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSavePrintersPasscode}
              disabled={printersNewPasscode.length !== 6}
              className="bg-primary text-primary-foreground text-xs h-8 rounded-lg font-semibold"
            >
              Save Passcode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Password Verification Modal for 6-Digit Passcode Setup */}
      <Dialog open={loginVerifyModalOpen} onOpenChange={setLoginVerifyModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border rounded-xl font-sans">
          <form onSubmit={handleVerifyLoginPassword}>
            <DialogHeader>
              <DialogTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <span>Verify Account Password</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-sans">
                Please enter your shopkeeper account login password to authorize configuration of the 6-digit security password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs font-sans">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground uppercase">
                  Account Login Password
                </Label>
                <div className="relative">
                  <Input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Enter your current login password"
                    value={loginPasswordInput}
                    onChange={(e) => {
                      setLoginPasswordInput(e.target.value);
                      if (loginPasswordError) setLoginPasswordError(null);
                    }}
                    autoFocus
                    className="pr-10 h-9 text-xs bg-muted/30 border-border rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginPasswordError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{loginPasswordError}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-lg text-[11px] text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Zero OTP required. Secured directly by your shopkeeper account credentials.</span>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLoginVerifyModalOpen(false)}
                className="text-xs h-8 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={verifyingLoginPassword || !loginPasswordInput.trim()}
                className="bg-primary text-primary-foreground text-xs h-8 rounded-lg font-semibold"
              >
                {verifyingLoginPassword ? 'Verifying...' : 'Verify & Continue'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
