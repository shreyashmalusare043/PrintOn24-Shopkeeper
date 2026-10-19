import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Play,
  QrCode,
  Upload,
  Sliders,
  CreditCard,
  Printer,
  CheckCircle2,
  Tv,
  ArrowRight,
  ShieldCheck,
  Zap,
  Laptop,
  Smartphone,
  Eye,
} from 'lucide-react';

export const DemoPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customer' | 'shopkeeper'>('customer');

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-red-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Header */}
      <section className="relative pt-12 pb-14 lg:pt-16 lg:pb-20 bg-gradient-to-b from-red-50/40 via-white to-white overflow-hidden text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-[#dc2626] text-xs font-bold uppercase tracking-wider mb-4">
            <Tv className="w-3.5 h-3.5" />
            <span>Interactive Demo & Visual Walkthrough</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
            See How <span className="text-[#dc2626]">printOn24</span> Works
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Experience our contactless digital printing workflow from both perspectives: the customer submitting an urgent order, and the shopkeeper executing instant 1-click silent hardware printing.
          </p>
        </div>
      </section>

      {/* Video Demo Section (Exactly 2 Ready-to-Embed Video Slots as requested) */}
      <section className="py-12 bg-neutral-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold font-mono text-red-400 uppercase tracking-widest">
              VIDEO DEMONSTRATION SLOTS
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Watch The Live Platform In Action
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2">
              Two high-definition walkthrough slots ready for video embedding.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Video Slot 1: Customer Workflow */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl group">
              <div className="space-y-3 mb-4 text-left">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                  <Smartphone className="w-3 h-3" />
                  <span>Video 1: Customer Ordering Walkthrough</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Scan QR, Upload Document & Pay
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Demonstrates QR code scanning, instant document upload, configuring B&W/Color and Duplex pages, selecting page ranges, and immediate digital payment.
                </p>
              </div>

              {/* 16:9 Video Container Slot */}
              <div className="relative aspect-video w-full bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center group-hover:border-red-500/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent pointer-events-none" />
                
                {/* Embed Slot Placeholder / Ready for iframe */}
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 z-10">
                  <div className="w-16 h-16 rounded-full bg-[#dc2626] text-white flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:scale-110 transition-transform cursor-pointer">
                    <Play className="w-7 h-7 fill-current translate-x-0.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Customer Mobile Experience</p>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">Embed Slot #1 • 1080p Full HD Ready</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Slot 2: Shopkeeper Workflow */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl group">
              <div className="space-y-3 mb-4 text-left">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                  <Laptop className="w-3 h-3" />
                  <span>Video 2: Shopkeeper & Hardware Dispatch</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Live Queue, Document Preview & Silent Print
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Demonstrates incoming live orders, document canvas inspection, zero-reprint segment management, and automatic routing to physical network and USB printers.
                </p>
              </div>

              {/* 16:9 Video Container Slot */}
              <div className="relative aspect-video w-full bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center group-hover:border-red-500/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent pointer-events-none" />
                
                {/* Embed Slot Placeholder / Ready for iframe */}
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 z-10">
                  <div className="w-16 h-16 rounded-full bg-[#dc2626] text-white flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:scale-110 transition-transform cursor-pointer">
                    <Play className="w-7 h-7 fill-current translate-x-0.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Shopkeeper Counter Terminal</p>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">Embed Slot #2 • 1080p Full HD Ready</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Step-by-Step Instructions (How to Use printOn24) */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-extrabold text-[#dc2626] uppercase tracking-widest">
              STEP-BY-STEP GUIDELINES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
              How to Use printOn24
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Select your role below to explore the simple step-by-step workflow.
            </p>

            <div className="mt-8 flex justify-center">
              <div className="bg-neutral-100 p-1.5 rounded-full inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('customer')}
                  className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'customer'
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Customer Journey (5 Easy Steps)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('shopkeeper')}
                  className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'shopkeeper'
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Shopkeeper Journey (4 Simple Steps)
                </button>
              </div>
            </div>
          </div>

          {/* Customer Journey Content */}
          {activeTab === 'customer' && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-left animate-in fade-in duration-300">
              {/* Step 1 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <h4 className="font-bold text-slate-900 text-base">Scan Shop QR</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Open your camera or QR scanner at the partner print shop. Tap the link to open the store terminal.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <h4 className="font-bold text-slate-900 text-base">Upload Files</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Select your documents directly from your device. Supports PDF, Word, Excel, PPT, JPG, and PNG files.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <h4 className="font-bold text-slate-900 text-base">Select Settings</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Choose Color or B&W, Single-side or Duplex, Copies, and specific page ranges (e.g. 1-5, 8).
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  04
                </div>
                <h4 className="font-bold text-slate-900 text-base">Make Payment</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pay securely via UPI, Card, NetBanking or choose Pay at Counter cash payment.
                </p>
              </div>

              {/* Step 5 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  05
                </div>
                <h4 className="font-bold text-slate-900 text-base">Collect Prints</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your token number is called as the pages spool instantly. Pick up your finished documents without delay.
                </p>
              </div>
            </div>
          )}

          {/* Shopkeeper Journey Content */}
          {activeTab === 'shopkeeper' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left animate-in fade-in duration-300">
              {/* Step 1 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <h4 className="font-bold text-slate-900 text-base">Instant Order Arrival</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Orders appear in real time on your live dashboard with customer token, document details, and payment confirmation.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <h4 className="font-bold text-slate-900 text-base">Preview Documents</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inspect pages in high fidelity. Filter by pending pages to ensure zero reprint of previously printed segments.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <h4 className="font-bold text-slate-900 text-base">1-Click Hardware Print</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Click &ldquo;Go For Print&rdquo;. The system automatically routes color pages to color printers and B&W to high-speed mono printers.
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm space-y-3 relative group hover:border-red-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold text-sm">
                  04
                </div>
                <h4 className="font-bold text-slate-900 text-base">Complete & Settle</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hand over prints to the customer. All earnings are logged with automated settlement reports.
                </p>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-neutral-50 border-t border-neutral-200 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-black text-slate-900 mb-3">
            Want to See a Custom Demo for Your Printing Business?
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Contact our partnership team for a remote walkthrough and onboarding consultation.
          </p>
          <Link to="/enquiry">
            <Button size="lg" className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-8 py-6 rounded-full text-sm">
              Schedule Shopkeeper Consultation
            </Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default DemoPage;
