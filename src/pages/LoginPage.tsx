import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Zap,
  ShieldCheck,
  MapPin,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Info,
  KeyRound,
  Store,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Easily editable & replaceable visual composition graphic for Login Page
export const LOGIN_GRAPHIC_URL =
  '/Transparent 3D Printer Document Orbit.png';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useShopkeeper();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // If already authenticated with active shopkeeper session, route straight to Live Orders & Queue
  useEffect(() => {
    if (user && user.shop_id) {
      navigate('/orders', { replace: true });
    }
  }, [user, navigate]);

  // Forgot password states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'verify'>('email');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Trusted device auto-login on mount
  useEffect(() => {
    shopkeeperApi.autoLoginTrustedDevice().then((res) => {
      if (res.success && res.user) {
        toast.success(`Welcome back, ${res.user.owner_name}! Automatically signed in on trusted device.`);
        navigate('/orders');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter both your email address and password');
      return;
    }

    setLoading(true);
    try {
      const res = await login(email.trim(), password, rememberMe);
      if (res.success) {
        if (res.isNewDevice) {
          toast.info('New device detected: A security alert has been dispatched to your email.');
        }
        toast.success('Welcome back to printOn24!');
        navigate('/orders');
      } else {
        toast.error(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch {
      toast.error('An unexpected error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Please enter your registered email address');
      return;
    }
    setResetSubmitting(true);
    try {
      const res = await shopkeeperApi.requestPasswordReset(forgotEmail.trim());
      toast.success(res.message);
      setForgotStep('verify');
    } catch {
      toast.error('Could not process request. Please try again.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const policy = shopkeeperApi.validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      toast.error(policy.error);
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await shopkeeperApi.confirmPasswordReset(forgotEmail.trim(), resetOtp.trim(), newPassword);
      if (res.success) {
        toast.success(res.message);
        setForgotOpen(false);
        setForgotStep('email');
        setForgotEmail('');
        setResetOtp('');
        setNewPassword('');
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to reset password. Please try again.');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-red-500 selection:text-white">
      {/* Top Navbar */}
      <PublicNavbar />
      {/* Main Login 2-Column Section (Top-aligned for immediate visibility without scrolling) */}
      <main className="flex-1 flex items-start justify-center pt-4 sm:pt-6 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Soft Crimson Ambient Glows */}
        <div className="absolute top-10 left-10 w-[450px] h-[450px] bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl w-full mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left Column: Platform Branding & Seamless Transparent Graphic */}
            <div className="lg:col-span-6 space-y-4 sm:space-y-5 text-left pt-2">
              <div className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />
                <span className="text-xs sm:text-sm font-extrabold tracking-widest text-[#dc2626] uppercase">
                  SMART PRINTING SOLUTIONS
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15] text-slate-900">
                Welcome Back! <br />
                <span className="text-[#dc2626]">Log in to Your Account</span>
              </h1>

              <p className="text-sm sm:text-base text-slate-600 max-w-lg font-normal leading-relaxed">
                Access your print settings, upload files, track orders and manage your documents — all in one place.
              </p>

              {/* 3 Value Badges */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-5 pt-1 text-xs sm:text-sm font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[#dc2626]">
                    <Zap className="w-3 h-3 fill-current" />
                  </div>
                  <span>Fast & Easy Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[#dc2626]">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                  <span>Secure & Reliable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[#dc2626]">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <span>Local Shops</span>
                </div>
              </div>

              {/* Visual Composition Image: Seamless without border or container */}
              <div className="pt-2 max-w-sm lg:max-w-md mx-auto lg:mx-0 bg-transparent flex items-center justify-center border-0 outline-none ring-0">
                <img
                  src={LOGIN_GRAPHIC_URL}
                  alt="printOn24 Login Visual Composition"
                  className="w-full h-auto object-contain drop-shadow-md select-none pointer-events-none border-0 outline-none"
                />
              </div>
            </div>

            {/* Right Column: Clean White Login Card (Aligned near top of viewport) */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-xl shadow-neutral-200/50 relative">
                
                {/* Brand Logo in Card */}
                <div className="text-center mb-6">
                  <Link to="/" className="inline-block">
                    <img
                      src="/images/logo/printon24-logo.png"
                      alt="printOn24"
                      className="h-10 sm:h-12 mx-auto object-contain"
                    />
                  </Link>
                  <h2 className="text-xl font-bold text-slate-900 mt-3">
                    Login to Your Account
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Enter your email and password to continue
                  </p>
                </div>

                {/* Account Disabled Security Notice */}
                {((location.state as any)?.accountDisabled || (location.state as any)?.disabledReason) && (
                  <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-left flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800">
                      <p className="font-bold text-red-900">Account Access Suspended</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-red-700">
                        {(location.state as any)?.disabledReason ||
                          'Your shopkeeper account has been disabled by the Super Administrator. Access has been suspended. Please contact support or the administrator to restore your access.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="email" className="text-xs font-bold text-slate-700">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 h-12 rounded-xl border-neutral-300 focus:border-[#dc2626] focus:ring-[#dc2626] text-sm"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="password" className="text-xs font-bold text-slate-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10 pr-10 h-12 rounded-xl border-neutral-300 focus:border-[#dc2626] focus:ring-[#dc2626] text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                        className="data-[state=checked]:bg-[#dc2626] data-[state=checked]:border-[#dc2626]"
                      />
                      <span className="font-medium">Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="font-semibold text-[#dc2626] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#b91c1c] hover:to-[#991b1b] text-white font-bold text-base rounded-full shadow-lg shadow-red-500/25 transition-all duration-300 flex items-center justify-center gap-2 group mt-2"
                  >
                    <span>{loading ? 'Logging in...' : 'Login'}</span>
                    {!loading && (
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    )}
                  </Button>
                </form>

                {/* Super Admin Notice (No public registration) */}
                <div className="mt-8 pt-6 border-t border-neutral-100 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>Shopkeeper accounts are managed by Super Admin</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Want to partner with printOn24?{' '}
                    <Link to="/enquiry" className="font-bold text-[#dc2626] hover:underline">
                      Send an Enquiry
                    </Link>
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              {forgotStep === 'email' ? 'Reset Your Password' : 'Enter Verification Code'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {forgotStep === 'email'
                ? 'Enter your registered shopkeeper email address and we will send a secure single-use reset code.'
                : `Enter the 6-digit code dispatched to ${forgotEmail} and choose a strong new password.`}
            </p>

            {forgotStep === 'email' ? (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                <div className="space-y-1 text-left">
                  <Label htmlFor="forgot-email" className="text-xs font-bold text-slate-700">
                    Registered Email
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="name@shop.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="h-11 rounded-xl text-xs"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForgotOpen(false);
                      setForgotStep('email');
                    }}
                    className="flex-1 h-10 text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetSubmitting}
                    className="flex-1 h-10 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold rounded-xl"
                  >
                    {resetSubmitting ? 'Checking...' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div className="space-y-1 text-left">
                  <Label htmlFor="reset-otp" className="text-xs font-bold text-slate-700">
                    6-Digit Verification Code
                  </Label>
                  <Input
                    id="reset-otp"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    className="h-11 rounded-xl text-center text-base tracking-widest font-mono"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <Label htmlFor="new-password" className="text-xs font-bold text-slate-700">
                    New Secure Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Min. 8 chars with letter, number & symbol"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-1">
                    Must be at least 8 characters, containing letters, numbers, and symbols. No weak common patterns.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForgotStep('email')}
                    className="flex-1 h-10 text-xs rounded-xl"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetSubmitting}
                    className="flex-1 h-10 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold rounded-xl"
                  >
                    {resetSubmitting ? 'Resetting...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default LoginPage;
