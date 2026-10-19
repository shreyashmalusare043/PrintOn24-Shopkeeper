import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import {
  Check,
  Zap,
  ShieldCheck,
  Printer,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Loader2,
  Store,
  Layers,
} from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  code?: string;
  description?: string;
  price: number | string;
  duration_days?: number;
  pc_limit?: number;
  features?: string[] | string;
  services?: string[] | string;
  is_active?: boolean;
  is_popular?: boolean;
}

export const PublicPricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLivePlans();
  }, []);

  const fetchLivePlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (!error && data && data.length > 0) {
        setPlans(data);
      } else {
        // Fallback default structure if table is empty
        setPlans([
          {
            id: 'plan-starter',
            name: 'Starter Print Plan',
            description: 'Ideal for neighborhood copy centers with single terminal setup.',
            price: 2000,
            duration_days: 30,
            pc_limit: 2,
            features: [
              'Up to 2 PC Terminals',
              'Standard Web Dashboard',
              'Razorpay Online Payments',
              'QR Code Ordering',
              'Email Support',
            ],
            is_popular: false,
          },
          {
            id: 'plan-pro',
            name: 'Pro Shop Plan',
            description: 'Best for high-volume campus printing centers and college reprography shops.',
            price: 5000,
            duration_days: 30,
            pc_limit: 4,
            features: [
              'Up to 4 PC Terminals',
              'Priority Queue Routing',
              'Dual Payment Modes (Cash & Online)',
              'VIP Member Discounts',
              'Automated 2-Day Settlements',
              'Phone & Ticket Support',
            ],
            is_popular: true,
          },
          {
            id: 'plan-enterprise',
            name: 'Enterprise Hub Plan',
            description: 'Full platform access for commercial printing hubs and university libraries.',
            price: 8000,
            duration_days: 30,
            pc_limit: 8,
            features: [
              'Up to 8 PC Terminals',
              'Zero Platform Commission tier',
              'Custom QR Branding',
              'Dedicated Account Manager',
              'Live Print Job Telemetry',
              '24/7 Priority SLA',
            ],
            is_popular: false,
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch pricing plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEnquiry = (plan: SubscriptionPlan) => {
    navigate(`/enquiry?package=${encodeURIComponent(plan.name)}&package_id=${encodeURIComponent(plan.id)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-red-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Header */}
      <section className="relative pt-12 pb-14 lg:pt-16 lg:pb-20 bg-gradient-to-b from-red-50/40 via-white to-white overflow-hidden text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-[#dc2626] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Partner Pricing</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
            Predictable Plans to Power <br />
            <span className="text-[#dc2626]">Your Print Shop</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Zero hidden costs. Choose a plan tailored for your store volume. Live packages configured directly by platform administrators.
          </p>
        </div>
      </section>

      {/* Plans Section */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#dc2626] animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading live packages from database...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {plans.map((plan) => {
                const isPopular = plan.is_popular || false;
                const featureList = Array.isArray(plan.features)
                  ? plan.features
                  : typeof plan.features === 'string'
                  ? JSON.parse(plan.features || '[]')
                  : [];

                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                      isPopular
                        ? 'bg-white border-2 border-[#dc2626] shadow-xl shadow-red-500/10 lg:-translate-y-2'
                        : 'bg-white border border-neutral-200/90 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#dc2626] text-white text-xs font-extrabold uppercase px-4 py-1.5 rounded-full shadow-md tracking-wider">
                        Most Popular Choice
                      </div>
                    )}

                    <div>
                      {/* Plan Header */}
                      <div className="text-left space-y-2">
                        <h3 className="text-2xl font-black text-slate-900">{plan.name}</h3>
                        <p className="text-xs text-slate-500 min-h-[36px] leading-relaxed">
                          {plan.description || 'Full platform capabilities for registered shopkeepers.'}
                        </p>
                      </div>

                      {/* Pricing Display */}
                      <div className="my-6 text-left border-y border-neutral-100 py-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-slate-900">₹</span>
                          <span className="text-5xl font-black text-slate-900">
                            {Number(plan.price).toLocaleString('en-IN')}
                          </span>
                          <span className="text-sm font-semibold text-slate-500">
                            / {plan.duration_days || 30} Days
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Billed monthly • GST applicable as per regulations
                        </p>
                      </div>

                      {/* Key Metric Highlights */}
                      <div className="bg-neutral-50 rounded-2xl p-4 mb-6 text-left space-y-2 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-700">
                          <span>Allowed Counter PCs:</span>
                          <span className="text-[#dc2626] font-bold">
                            {plan.pc_limit || 2} Terminals
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-semibold text-slate-700">
                          <span>Printer Hardware Connections:</span>
                          <span className="text-slate-900 font-bold">Unlimited Spooling</span>
                        </div>
                      </div>

                      {/* Feature Checklist */}
                      <div className="space-y-3 text-left">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                          What&apos;s Included:
                        </p>
                        <ul className="space-y-2.5">
                          {featureList.map((feat: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                              <div className="w-4 h-4 rounded-full bg-red-100 text-[#dc2626] flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="leading-snug">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Send Enquiry CTA Button (Strictly Replaced Buy Now) */}
                    <div className="pt-8 mt-6 border-t border-neutral-100">
                      <Button
                        onClick={() => handleSendEnquiry(plan)}
                        className={`w-full py-6 rounded-full font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group ${
                          isPopular
                            ? 'bg-[#dc2626] hover:bg-[#b91c1c] text-white shadow-red-500/20'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <span>Send Enquiry</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-neutral-50/70 border-t border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Everything you need to know about partnering with printOn24
            </p>
          </div>

          <div className="space-y-4 text-left">
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-2">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">
                How does the Send Enquiry process work?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                When you click &ldquo;Send Enquiry&rdquo;, you will be taken to our Shopkeeper Application form with your chosen package pre-filled. After entering your personal and store details, our onboarding team reviews your store location and sets up your credentials.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-2">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">
                Can I upgrade my terminal PC limit later?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Yes. You can upgrade your plan or request additional PC terminal licenses anytime from your shopkeeper dashboard or through our support team.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-2">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">
                Do I need special hardware to use printOn24?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                No special hardware required! You only need a standard Windows PC connected to your existing USB or Network printers (Canon, HP, Epson, Brother, TVS, etc.) with internet access.
              </p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default PublicPricingPage;
