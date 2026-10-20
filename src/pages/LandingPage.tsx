import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import {
  Zap,
  ShieldCheck,
  MapPin,
  ArrowRight,
  FileText,
  Sliders,
  Store,
  Percent,
  CheckCircle2,
  Printer,
  Sparkles,
  CreditCard,
  Upload,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user } = useShopkeeper();

  // If shopkeeper has a valid active session, bypass landing page and open Live Orders & Queue directly
  if (user && user.shop_id) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-red-500 selection:text-white font-sans relative overflow-x-hidden">
      {/* Top Header Navigation */}
      <PublicNavbar />
      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-10 pb-16 lg:pb-24 overflow-hidden mb-[0px]">
        {/* Ambient background glows */}
        <div className="absolute top-10 right-0 w-[550px] h-[550px] bg-gradient-to-br from-red-500/15 via-rose-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-red-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8 text-left">
              {/* Category Eyebrow */}
              <div className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />
                <span className="text-xs sm:text-sm font-extrabold tracking-widest text-[#dc2626] uppercase">
                  SMART PRINTING SOLUTIONS
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="landing-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-slate-900">
                Print Your Documents <br />
                <span className="text-[#dc2626] inline-block mt-1">Anytime, Anywhere</span>
              </h1>

              {/* Description Body */}
              <p className="text-base sm:text-lg text-slate-600 max-w-xl font-normal leading-relaxed">
                printOn24 makes printing simple, fast and convenient. Upload your files, choose your print settings, pay securely and get your documents printed at your nearest shop.
              </p>

              {/* 3 Quick Badges */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-1 text-xs sm:text-sm font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[#dc2626]">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span>Fast & Easy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[#dc2626]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span>Secure Payments</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[#dc2626]">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span>Local Shops</span>
                </div>
              </div>

              {/* Primary Call to Action Button */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link to="/login">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#b91c1c] hover:to-[#991b1b] text-white font-bold text-base px-8 py-6 rounded-full shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 transition-all duration-300 flex items-center gap-3 group"
                  >
                    <span>Login</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>

                <Link to="/enquiry">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-neutral-300 text-neutral-700 hover:text-[#dc2626] hover:border-red-300 font-semibold text-sm px-6 py-6 rounded-full"
                  >
                    Partner with Us
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Visual Column (Direct transparent image blending naturally into background) */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="relative w-full max-w-lg lg:max-w-none mx-auto flex items-center justify-center border-0 outline-none ring-0 shadow-none p-0 bg-transparent">
                <img
                  src="/Print Workflow Orbit Illustration.png"
                  alt="printOn24 Smart Printing Solutions - Print your documents anytime, anywhere"
                  className="w-full max-w-md lg:max-w-xl h-auto object-contain transition duration-500 drop-shadow-md select-none pointer-events-none border-0 outline-none ring-0"
                  data-editor-config="%7B%22defaultSrc%22%3A%22https%3A%2F%2Fmiaoda-edit-image.s3cdn.medo.dev%2Feteq08019atd%2FIMG-f01dhccs9rls.png%22%7D"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 5 Bottom Feature Cards */}
      <section className="relative pb-24 lg:pb-32 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
            
            {/* Card 1: Multiple File Formats */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-[#dc2626] mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="landing-heading text-base font-bold text-slate-900 mb-2">
                  Multiple File Formats
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG & more
                </p>
              </div>
            </div>

            {/* Card 2: Custom Print Settings */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-[#dc2626] mb-4 group-hover:scale-110 transition-transform">
                  <Sliders className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Custom Print Settings
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Size, Color, Sides, Copies, Layout, Page Range & more
                </p>
              </div>
            </div>

            {/* Card 3: Secure & Reliable */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-[#dc2626] mb-4 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Secure & Reliable
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your files are safe with us
                </p>
              </div>
            </div>

            {/* Card 4: Print at Nearest Shop */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-[#dc2626] mb-4 group-hover:scale-110 transition-transform">
                  <Store className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Print at Nearest Shop
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Support local businesses
                </p>
              </div>
            </div>

            {/* Card 5: 0 Platform Charges */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-[#dc2626] mb-4 group-hover:scale-110 transition-transform">
                  <Percent className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  0 Platform Charges
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Print when you need, not when it&apos;s convenient
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Decorative Wave at the Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none overflow-hidden">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-cover"
            preserveAspectRatio="none"
          >
            <path
              d="M0 60C240 120 480 0 720 60C960 120 1200 20 1440 60V120H0V60Z"
              fill="url(#red-wave-gradient)"
              opacity="0.12"
            />
            <defs>
              <linearGradient id="red-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>
      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default LandingPage;
