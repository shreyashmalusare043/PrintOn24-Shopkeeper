import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, ArrowRight, ShieldCheck, Printer } from 'lucide-react';

export const PublicNavbar: React.FC = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'About Us', path: '/about' },
    { label: 'Demo', path: '/demo' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Enquiry', path: '/enquiry' },
    { label: 'Login', path: '/login' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-neutral-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center group select-none">
          <img
            src="https://miaoda-edit-image.s3cdn.medo.dev/eteq08019atd/IMG-ezcrheaf25mo.png"
            alt="printOn24"
            className="h-10 sm:h-11 max-w-[170px] object-contain shrink-0"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-semibold transition-colors duration-200 ${
                isActive(link.path)
                  ? 'text-[#dc2626] font-bold'
                  : 'text-neutral-700 hover:text-[#dc2626]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right CTA Button (Hidden on Login / Auth pages as requested) */}
        {!['/login', '/auth'].includes(location.pathname) && (
          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button
                className="bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#b91c1c] hover:to-[#991b1b] text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 flex items-center gap-2 group"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        )}

        {/* Mobile Hamburger Menu */}
        <div className="md:hidden flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-neutral-700 hover:text-neutral-900"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px] bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-neutral-100">
                  <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center">
                    <img
                      src="https://miaoda-edit-image.s3cdn.medo.dev/eteq08019atd/IMG-ezcrheaf25mo.png"
                      alt="printOn24"
                      className="h-9 max-w-[150px] object-contain shrink-0"
                    />
                  </Link>
                </div>

                <div className="flex flex-col gap-4 mt-6">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={`text-base font-semibold py-2 px-3 rounded-lg transition-colors ${
                        isActive(link.path)
                          ? 'bg-red-50 text-[#dc2626]'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-[#dc2626]'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              {!['/login', '/auth'].includes(location.pathname) && (
                <div className="pt-6 border-t border-neutral-100 flex flex-col gap-3">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="w-full">
                    <Button className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold py-2.5 rounded-full flex items-center justify-center gap-2">
                      <span>Get Started</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <p className="text-center text-xs text-neutral-400">
                    Smart Digital Printing Solutions
                  </p>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
