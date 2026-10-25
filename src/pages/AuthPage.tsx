import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Printer,
  ShieldCheck,
  Zap,
  ArrowRight,
  Lock,
  Mail,
  Phone,
  User,
  Store,
  MapPin,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  QrCode,
  Sparkles,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, themeMode, setThemeMode, language, setLanguage, t } = useShopkeeper();

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupShopName, setSignupShopName] = useState('');
  const [signupOwnerName, setSignupOwnerName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupCity, setSignupCity] = useState('Pune');
  const [signupAddress, setSignupAddress] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'newpass'>('email');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendTimer, setResendTimer] = useState(30);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter both Email and Password');
      return;
    }

    setLoading(true);
    try {
      const res = await login(loginEmail, loginPassword);
      if (res.success) {
        navigate('/');
      } else {
        toast.error(res.error || 'Login failed');
      }
    } catch {
      toast.error('Authentication error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupShopName || !signupOwnerName || !signupEmail || !signupPassword) {
      toast.error('Please fill in all mandatory shop registration fields');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await shopkeeperApi.signup({
        shop_name: signupShopName.trim(),
        owner_name: signupOwnerName.trim(),
        email: signupEmail.trim(),
        phone: signupPhone.trim() || '+91 98000 00000',
        city: signupCity.trim() || 'Pune',
        address: signupAddress.trim() || `${signupCity || 'Pune'} Commercial District`,
        password: signupPassword,
      });

      if (res.success && res.user) {
        toast.success('Shopkeeper account registered successfully!');
        const loginRes = await login(signupEmail.trim(), signupPassword);
        if (loginRes.success) {
          navigate('/');
        } else {
          toast.info('Account created. Please login with your password.');
          setAuthMode('login');
          setLoginEmail(signupEmail.trim());
        }
      } else {
        toast.error(res.error || 'Registration failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create shop account');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your registered email');
      return;
    }
    setForgotStep('otp');
    toast.info('Password recovery OTP sent to ' + forgotEmail + ' (Use 123456 for demo)');
    startTimer();
  };

  const verifyForgotOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp) {
      toast.error('Please enter the OTP');
      return;
    }
    setForgotStep('newpass');
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await shopkeeperApi.resetPassword(forgotEmail, newPassword);
      if (res.success) {
        toast.success('Password updated successfully! Please login.');
        setAuthMode('login');
        setForgotStep('email');
      } else {
        toast.error('Password update failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col md:flex-row bg-background overflow-x-hidden font-sans">
      {/* ---------------- LEFT SIDE: VISUAL BRANDING WITH ANGULAR / DIAGONAL DIVIDER ---------------- */}
      <div className="relative w-full md:w-1/2 min-h-[380px] md:min-h-screen bg-card flex flex-col justify-between p-6 md:p-12 z-10 overflow-hidden border-b md:border-b-0 border-border">
        {/* Angular Diagonal SVG / CSS visual edge slice */}
        <div
          className="hidden md:block absolute top-0 -right-12 bottom-0 w-24 bg-card pointer-events-none z-20"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
            transform: 'scaleX(-1)',
          }}
        />

        {/* Ambient glow & laser line */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 bg-primary/10 blur-3xl pointer-events-none" />

        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 border border-primary flex items-center justify-center bg-primary/10 text-primary">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-xl tracking-tight font-bold text-foreground">
                print<span className="text-primary">On24</span>
              </span>
              <span className="text-[10px] uppercase font-sans font-semibold px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40">
                Shop Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-sans">printOn24™ Commercial Hub</p>
          </div>
        </div>

        {/* Center Illustration & Value Props */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/60 border border-border text-xs text-muted-foreground mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Dedicated Multi-Tenant Shopkeeper Terminal</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-heading font-bold tracking-tight text-foreground mb-4 leading-tight">
            Precision Management for Modern <span className="text-primary">Print Workshops</span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground max-w-md mb-8 leading-relaxed">
            Direct queue processing, independent PC terminal QR routing, multi-printer usage mapping, and verified
            48-hour revenue settlements.
          </p>

          {/* Feature Badges Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="p-3 bg-muted/40 border border-border flex items-start gap-2.5">
              <QrCode className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">PC Terminal QRs</p>
                <p className="text-[11px] text-muted-foreground">Direct-to-screen queue uploads</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-border flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">Smart Dispatch</p>
                <p className="text-[11px] text-muted-foreground">Color vs B&W printer routing</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-border flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">Isolated Tenancy</p>
                <p className="text-[11px] text-muted-foreground">Strict shop-level security</p>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-border flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">Paper Reminders</p>
                <p className="text-[11px] text-muted-foreground">Consumables alert thresholds</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status / Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-4 border-t border-border">
          <span>SRS v2.4 • Commercial Ready</span>
          <span className="flex items-center gap-1.5 text-primary">
            <span className="w-1.5 h-1.5 bg-primary animate-ping" />
            Backend Online
          </span>
        </div>
      </div>

      {/* ---------------- RIGHT SIDE: INTERACTIVE AUTHENTICATION FORM ---------------- */}
      <div className="relative w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-background z-20">
        <div className="w-full max-w-md">
          {/* Quick Header Controls (Language & Theme Mode Switcher) */}
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
              <Globe className="w-4 h-4 text-primary" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-card border border-border text-xs px-2 py-1 font-sans text-foreground rounded-none shadow-sm focus:outline-none focus:border-primary"
              >
                <option value="en">English</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              className="h-8 px-2.5 text-xs font-sans gap-1.5 border-border shadow-sm"
              title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-medium">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">Dark Mode</span>
                </>
              )}
            </Button>
          </div>

          {/* Top Mode Selector Tabs */}
          {authMode !== 'forgot' && (
            <Tabs
              value={authMode}
              onValueChange={(val) => setAuthMode(val as 'login' | 'signup')}
              className="w-full mb-6"
            >
              <TabsList className="grid grid-cols-2 w-full bg-muted border border-border p-1">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-sans font-semibold text-xs uppercase"
                >
                  Shopkeeper Login
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-sans font-semibold text-xs uppercase"
                >
                  Register Shop
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* 1. LOGIN MODE */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1 mb-2">
                <h2 className="text-xl font-heading font-bold tracking-tight text-foreground">Shopkeeper Access</h2>
                <p className="text-xs text-muted-foreground font-sans">
                  Sign in with your registered shopkeeper email and password to access your shop panel.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase text-foreground">Registered Email ID</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="shopkeeper@printing.com"
                    required
                    className="pl-9 bg-card border-border text-foreground text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-mono uppercase text-foreground">Password</Label>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="text-xs text-primary hover:underline font-mono"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="pl-9 bg-card border-border text-foreground text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm py-2.5 mt-2"
              >
                {loading ? 'Authenticating Terminal...' : 'Enter Shopkeeper Panel'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="text-center pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  New printing shop owner?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className="text-primary font-medium hover:underline"
                  >
                    Register your shop here
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 2. SIGNUP MODE */}
          {authMode === 'signup' && (
            <div>
              <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                  <div className="space-y-1 mb-1">
                    <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Shop Registration</h2>
                    <p className="text-xs text-muted-foreground">
                      Set up your shop profile and pricing. Register PC terminals manually after signup.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-mono uppercase">Shop / Xerox Name *</Label>
                      <div className="relative">
                        <Store className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          value={signupShopName}
                          onChange={(e) => setSignupShopName(e.target.value)}
                          placeholder="Shivaji Fast Prints"
                          required
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-mono uppercase">Owner Name *</Label>
                      <div className="relative">
                        <User className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          value={signupOwnerName}
                          onChange={(e) => setSignupOwnerName(e.target.value)}
                          placeholder="Sanjay Kadam"
                          required
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-mono uppercase">Email Address *</Label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="owner@prints.com"
                          required
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-mono uppercase">Contact Number *</Label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          type="tel"
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                          placeholder="+91 98220 12345"
                          required
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-mono uppercase">City / Location *</Label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          value={signupCity}
                          onChange={(e) => setSignupCity(e.target.value)}
                          placeholder="Pune"
                          required
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-mono uppercase">Shop Address / Landmark</Label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          value={signupAddress}
                          onChange={(e) => setSignupAddress(e.target.value)}
                          placeholder="Opposite FC College Main Gate, Pune"
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-mono uppercase">Create Password *</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                      <Input
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="pl-9 text-xs"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm py-2.5 mt-2"
                  >
                    {loading ? 'Creating Shop Account...' : 'Register Shop & Generate Unique QR'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Already have a shopkeeper account? Login here
                    </button>
                  </div>
                </form>
            </div>
          )}

          {/* 3. FORGOT PASSWORD MODE */}
          {authMode === 'forgot' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Password Recovery</h2>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setForgotStep('email');
                  }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  Back to Login
                </button>
              </div>

              {forgotStep === 'email' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Enter your registered email address. We will send an OTP verification code.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase">Registered Email</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                      <Input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="shopkeeper@printing.com"
                        required
                        className="pl-9 text-sm"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground font-mono">
                    Send OTP Verification
                  </Button>
                </form>
              )}

              {forgotStep === 'otp' && (
                <form onSubmit={verifyForgotOtp} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Enter the code sent to <strong className="text-foreground">{forgotEmail}</strong>.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase">Enter OTP Code</Label>
                    <Input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
                      placeholder="123456"
                      className="text-center font-mono tracking-widest text-lg"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      disabled={resendTimer > 0}
                      onClick={startTimer}
                      className="text-primary hover:underline font-mono disabled:opacity-50"
                    >
                      {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground font-mono">
                    Verify Code
                  </Button>
                </form>
              )}

              {forgotStep === 'newpass' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <p className="text-xs text-muted-foreground">Enter and confirm your new password.</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase">New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase">Confirm New Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground font-mono"
                  >
                    {loading ? 'Updating Password...' : 'Save New Password & Login'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
