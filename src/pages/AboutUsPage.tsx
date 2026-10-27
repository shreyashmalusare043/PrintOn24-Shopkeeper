import React from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import {
  Printer,
  QrCode,
  UploadCloud,
  Sliders,
  CreditCard,
  Store,
  ShieldCheck,
  Zap,
  Target,
  Compass,
  Code2,
  Users,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Layers,
  Sparkles,
  Building2,
} from 'lucide-react';

export const AboutUsPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-red-500 selection:text-white">
      <PublicNavbar />
      {/* Hero Header */}
      <section className="relative pt-12 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-red-50/50 via-white to-white overflow-hidden">
        <div className="absolute top-0 right-10 w-96 h-96 bg-red-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-rose-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100/80 text-[#dc2626] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover Our Story & Mission</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
            Revolutionizing Daily Printing Through{' '}
            <span className="text-[#dc2626]">Intelligent Technology</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            printOn24 bridges the gap between everyday document creators and neighborhood reprography centers, transforming physical print shops into high-speed digital service hubs.
          </p>
        </div>
      </section>
      {/* About PrintOn24 Detailed Section */}
      <section className="py-16 lg:py-20 border-t border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6 text-left">
              <span className="text-xs font-extrabold text-[#dc2626] uppercase tracking-widest">
                WHAT IS PRINTON24?
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-snug">
                The Complete Digital Document Printing Ecosystem
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                printOn24 was conceived to eliminate the age-old frustrations of physical document printing — long queues, broken file formatting, WhatsApp chaos, USB virus risks, and awkward cash handling.
              </p>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Our platform provides a smooth end-to-end workflow: customers scan a unique shop QR code from any smartphone or laptop, upload documents in any format (PDF, DOCX, XLSX, PPTX, JPG), customize print parameters (color mode, duplex, paper sizes, page ranges), make swift online or counter payments, and collect crisp physical prints within seconds.
              </p>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                For printing businesses, printOn24 acts as an intelligent digital dispatcher. Incoming orders are instantly spooled to connected counter PCs and routed to the exact matching physical printer (B&W or Color, Single-Side or Duplex) without requiring the shopkeeper to manually open heavy desktop applications.
              </p>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-red-50/60 border border-red-100 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">QR-Based Instant Discovery</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every partner store is assigned a tamper-proof dynamic QR code. Customers simply point their camera and begin uploading immediately.
                </p>
              </div>

              <div className="bg-red-50/60 border border-red-100 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Precision Print Engine</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Segment-level range control, orientation locking, paper thickness selection, and zero-reprint guarantees ensure print accuracy.
                </p>
              </div>

              <div className="bg-red-50/60 border border-red-100 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Flexible Dual Payments</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Integrated PayU UPI / card payments alongside traditional pay-at-counter cash modes give customers and shops ultimate flexibility.
                </p>
              </div>

              <div className="bg-red-50/60 border border-red-100 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Silent Hardware Dispatch</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Direct hardware communication via local workstation agents automatically assigns jobs to available printers without popup dialogs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Mission & Vision Section (4-5 lines each as requested) */}
      <section className="py-16 bg-neutral-50/80 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Mission Card */}
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-neutral-200 shadow-sm space-y-4 text-left relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center mb-2">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Our Mission</h3>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                <p>
                  To democratize and streamline document printing by eliminating manual queues, file incompatibility, and tedious communication bottlenecks.
                </p>
                <p>
                  To empower local xerox and print shops with enterprise-grade cloud automation, direct hardware spooling, and transparent digital accounting.
                </p>
                <p>
                  To provide students, professionals, and citizens with instantaneous access to dependable, high-quality printing within their own neighborhoods.
                </p>
                <p>
                  To continuously innovate environmentally conscious, paper-optimized workflows that reduce print waste and foster community business growth.
                </p>
              </div>
            </div>

            {/* Vision Card */}
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-neutral-200 shadow-sm space-y-4 text-left relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center mb-2">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Our Vision</h3>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                <p>
                  To build the country&apos;s most reliable, secure, and accessible interconnected digital printing infrastructure.
                </p>
                <p>
                  To turn every printing terminal into an automated, zero-latency cloud node capable of processing any document format in milliseconds.
                </p>
                <p>
                  To nurture the digital transformation of independent reprographic entrepreneurs so they can scale alongside India&apos;s digital economy.
                </p>
                <p>
                  To establish printOn24 as the undisputed benchmark for contactless, privacy-assured document handling across educational campuses, tech hubs, and commercial centers.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
      {/* Team & Credits Section (Strictly displaying requested names & roles) */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold text-[#dc2626] uppercase tracking-widest">
              LEADERSHIP & ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2">
              Team & Credits
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              The passionate engineers and growth strategists behind the printOn24 printing network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Powered by */}
            <div className="from-neutral-900 to-neutral-950 text-white rounded-3xl p-8 shadow-xl flex flex-col justify-between text-left relative overflow-hidden group bg-inherit bg-cover bg-center bg-no-repeat bg-[url(https://miaoda-edit-image.s3cdn.medo.dev/eteq08019atd/IMG-f02tw1opmlmo.png)]">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl text-[#dc2626] flex items-center justify-center bg-[#ffffff] bg-none">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-widest font-bold text-[#ffffff]">
                    TECHNOLOGY PARTNER
                  </span>
                  <h3 className="text-2xl font-black text-white">Powered by</h3>
                </div>
                <p className="text-lg font-bold text-neutral-100">
                  High Resolution Software and Coding
                </p>
                <p className="text-xs leading-relaxed text-[#ffffff]">
                  Leading enterprise software architecture, cloud telemetry, resilient infrastructure, and secure print protocols.
                </p>
              </div>
              <div className="pt-6 border-t border-neutral-800 text-xs font-mono text-[#ffffff]">
                PUNE • MAHARASHTRA
              </div>
            </div>

            {/* Development Team */}
            <div className="bg-white rounded-3xl p-8 border border-neutral-200/90 shadow-sm flex flex-col justify-between text-left group hover:border-red-200 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#dc2626] flex items-center justify-center">
                  <Code2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-[#dc2626] font-bold">
                    ENGINEERING & CORE
                  </span>
                  <h3 className="text-2xl font-black text-slate-900">Development by</h3>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <p className="text-sm font-bold text-slate-900">Shreyash Malusare</p>
                    <p className="text-xs text-slate-500">Full Stack & Systems Architect</p>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <p className="text-sm font-bold text-slate-900">Hitesh Lokare</p>
                    <p className="text-xs text-slate-500">Core Frontend & Print Driver Integration</p>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <p className="text-sm font-bold text-slate-900">Rahul Mete</p>
                    <p className="text-xs text-slate-500">Cloud Services & Database Architect</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Marketing & Data Analysis Team */}
            <div className="bg-white rounded-3xl p-8 border border-neutral-200/90 shadow-sm flex flex-col justify-between text-left group hover:border-red-200 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#dc2626] flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-[#dc2626] font-bold">
                    GROWTH & ANALYTICS
                  </span>
                  <h3 className="text-2xl font-black text-slate-900">Marketing & Data Analysis</h3>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <p className="text-sm font-bold text-slate-900">Dattatray Bejgamwar</p>
                    <p className="text-xs text-slate-500">Head of Growth & Strategic Partnerships</p>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <p className="text-sm font-bold text-slate-900">Shravan Patil</p>
                    <p className="text-xs text-slate-500">Data Analytics & Merchant Operations</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
      {/* Customer & Shopkeeper Benefits */}
      <section className="py-16 bg-neutral-50/60 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Customer Benefits */}
            <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-4 text-left">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                Customer Benefits
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <span>Zero Queue Waiting: Send print jobs before leaving home or classroom.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <span>Privacy First: No need to hand over unlocked smartphones or share files on public chat apps.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <span>Live Transparency: Instant pricing calculations and dynamic page range verification.</span>
                </li>
              </ul>
            </div>

            {/* Shopkeeper Benefits */}
            <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-4 text-left">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                Shopkeeper Benefits
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <span>Double Daily Throughput: Automate file opening, driver settings, and paper size mapping.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <span>Zero Re-print Loss: Page-level tracking prevents accidental duplicate printing.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <span>Multi-PC Multi-Printer Clustering: Balance load across all counter printers automatically.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      {/* Call to Action */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-black text-slate-900 mb-4">
            Ready to Experience the Future of Printing?
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Whether you want to print your college thesis or scale your high-street printing shop, printOn24 is here to power your success.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/demo">
              <Button size="lg" className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-8 py-6 rounded-full text-sm">
                Watch Demo Walkthrough
              </Button>
            </Link>
            <Link to="/enquiry">
              <Button variant="outline" size="lg" className="border-neutral-300 text-slate-700 font-semibold px-8 py-6 rounded-full text-sm">
                Apply as a Shop Partner
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
};

export default AboutUsPage;
