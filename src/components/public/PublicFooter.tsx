import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail } from 'lucide-react';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="relative bg-neutral-950 text-white overflow-hidden border-t border-neutral-800">
      {/* Background image covering complete footer area with blended gradient overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'url(https://miaoda-edit-image.s3cdn.medo.dev/eteq08019atd/IMG-ezy9e69bme4g.png)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/90 via-neutral-950/95 to-neutral-950 pointer-events-none" />

      {/* Subtle crimson glow */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#dc2626]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-64 h-64 bg-[#dc2626]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Compact Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-3">
            <Link to="/" className="inline-flex items-center select-none">
              <img
                src="/White printOn24© Logo with Sweeping Osterisk.png"
                alt="printOn24"
                className="h-8 sm:h-9 max-w-[150px] object-contain shrink-0"
              />
            </Link>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-sm">
              printOn24 makes printing simple, fast, and convenient. Upload your documents, choose your print settings, pay securely, and collect at your nearest verified shop.
            </p>
            <div className="pt-1 flex flex-col gap-1 text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#dc2626] shrink-0" />
                <span>Pune, Maharashtra, India</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#dc2626] shrink-0" />
                <span>support@printon24.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              Navigation
            </h4>
            <ul className="space-y-1.5 text-xs text-neutral-400">
              <li>
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="/demo" className="hover:text-white transition-colors">Demo & Walkthrough</Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition-colors">Shopkeeper Pricing</Link>
              </li>
              <li>
                <Link to="/enquiry" className="hover:text-white transition-colors">Partner Enquiry</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">Shopkeeper Login</Link>
              </li>
            </ul>
          </div>

          {/* Supported Formats */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              Print Capabilities
            </h4>
            <ul className="space-y-1.5 text-xs text-neutral-400">
              <li>PDF & Multi-Page Docs</li>
              <li>Word & Excel Spreadsheets</li>
              <li>Presentations (PPT, PPTX)</li>
              <li>High-Res JPG & PNG Photos</li>
              <li>Auto Duplex & Color Separation</li>
              <li>A4, A3, Legal, Bond & Glossy</li>
            </ul>
          </div>

          {/* Team & Credits */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
              Team & Credits
            </h4>
            <div className="space-y-2 text-[11px] text-neutral-300">
              <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                <p className="font-semibold text-white">Powered by</p>
                <p className="text-neutral-400">High Resolution Software and Coding</p>
              </div>
              <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                <p className="font-semibold text-white">Development by</p>
                <p className="text-neutral-400">Shreyash Malusare, Hitesh Lokare & Rahul Mete</p>
              </div>
              <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                <p className="font-semibold text-white">Marketing & Data Analysis</p>
                <p className="text-neutral-400">Dattatray Bejgamwar & Shravan Patil</p>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Bottom Bar */}
        <div className="mt-8 pt-5 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <p>© {new Date().getFullYear()} printOn24. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/policy" className="hover:text-neutral-200 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-neutral-200 transition-colors">Terms of Service</Link>
            <Link to="/enquiry" className="hover:text-neutral-200 transition-colors">Apply as Shopkeeper</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
