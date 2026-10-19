import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Store,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  CheckCircle2,
  Send,
  Loader2,
  Package,
} from 'lucide-react';

export const EnquiryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const prefilledPackage = searchParams.get('package') || '';
  const prefilledPackageId = searchParams.get('package_id') || '';

  // Form State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [panCardNumber, setPanCardNumber] = useState('');
  const [panName, setPanName] = useState('');
  const [address, setAddress] = useState('');

  // Business State
  const [shopName, setShopName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('Pune');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [businessContact, setBusinessContact] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessType, setBusinessType] = useState('Reprography / Xerox');
  const [gstNumber, setGstNumber] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(prefilledPackage || 'Pro Shop Plan');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().trim();
    setPanCardNumber(val);
  };

  const handlePanNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPanName(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !mobileNumber.trim() || !email.trim() || !panCardNumber.trim() || !address.trim()) {
      toast.error('Please complete all required Personal Information fields');
      return;
    }

    if (!shopName.trim() || !businessAddress.trim() || !city.trim() || !state.trim() || !pinCode.trim()) {
      toast.error('Please complete all required Business Information fields');
      return;
    }

    if (!panCardNumber.trim() || !panName.trim()) {
      toast.error('Please enter the PAN number and name as per PAN.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        full_name: fullName.trim(),
        mobile_number: mobileNumber.trim(),
        email: email.trim().toLowerCase(),
        pan_card_number: panCardNumber.trim().toUpperCase(),
        pan_verified: false,
        pan_holder_name: panName.trim(),
        pan_verification_status: 'Sent to PrintOn24 for verification',
        address: address.trim(),
        shop_name: shopName.trim(),
        business_address: businessAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        pin_code: pinCode.trim(),
        business_contact_number: businessContact.trim() || mobileNumber.trim(),
        business_email: businessEmail.trim().toLowerCase() || email.trim().toLowerCase(),
        business_type: businessType,
        gst_number: gstNumber.trim().toUpperCase() || null,
        selected_package_id: prefilledPackageId || null,
        selected_package_name: selectedPackage,
        enquiry_status: 'New',
        notes: `Application received for package: ${selectedPackage}`,
      };

      const { data, error } = await supabase
        .from('shopkeeper_enquiries')
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      setSubmittedId(data?.id || `ENQ-${Date.now().toString().slice(-6)}`);
      toast.success('Your enquiry was submitted. PAN details have been sent to PrintOn24 for verification.');
    } catch (err: any) {
      console.error('Enquiry submission error:', err);
      toast.error('Failed to submit enquiry. Please check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-red-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Header */}
      <section className="relative pt-12 pb-12 lg:pt-16 lg:pb-16 bg-gradient-to-b from-red-50/40 via-white to-white overflow-hidden text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-[#dc2626] text-xs font-bold uppercase tracking-wider mb-4">
            <Store className="w-3.5 h-3.5" />
            <span>Join the printOn24 Merchant Network</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Shopkeeper Partner Application
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Fill in your store details below to apply for a verified printOn24 terminal. Super Admin will review your application and generate your shop credentials.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {submittedId ? (
          /* Success Confirmation Card */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-neutral-200/90 shadow-xl text-center space-y-6 max-w-2xl mx-auto animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Application Submitted Successfully!
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Thank you for applying to partner with printOn24. Our onboarding officer will contact you within 24 hours.
              </p>
              <p className="text-sm font-semibold text-emerald-700 max-w-md mx-auto">
                Your PAN number and name have been sent to PrintOn24 for verification.
              </p>
            </div>

            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 max-w-sm mx-auto text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Enquiry ID:</span>
                <span className="font-mono font-bold text-slate-900">{submittedId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shop Name:</span>
                <span className="font-bold text-slate-900">{shopName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Package:</span>
                <span className="font-bold text-[#dc2626]">{selectedPackage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">City / State:</span>
                <span className="font-bold text-slate-900">{city}, {state}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link to="/">
                <Button className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs px-6 py-2.5 rounded-full">
                  Return to Home
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" className="text-xs px-6 py-2.5 rounded-full">
                  Explore More Plans
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* Section A: Personal Information (Left Column on Desktop) */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm space-y-5 text-left h-full flex flex-col">
                <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      A. Personal Information
                    </h3>
                    <p className="text-xs text-slate-500">
                      Details of the business owner or primary representative
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="full_name" className="text-xs font-bold text-slate-700">
                      Full Legal Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mobile" className="text-xs font-bold text-slate-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="mobile"
                      placeholder="e.g. +91 98765 43210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-bold text-slate-700">
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="e.g. owner@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  {/* PAN details are collected for PrintOn24's follow-up verification. */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="pan" className="text-xs font-bold text-slate-700">
                      PAN Card Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="pan"
                        placeholder="e.g. ABCDE1234F"
                        maxLength={10}
                        value={panCardNumber}
                        onChange={handlePanChange}
                        required
                        className="h-11 rounded-xl text-xs uppercase font-mono tracking-wider"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="pan_name" className="text-xs font-bold text-slate-700">
                      Full Name as per PAN <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pan_name"
                      placeholder="Enter the name printed on the PAN card"
                      value={panName}
                      onChange={handlePanNameChange}
                      maxLength={100}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">
                      Your PAN number and name will be sent to PrintOn24 for verification after you submit this form.
                    </p>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="address" className="text-xs font-bold text-slate-700">
                      Residential Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="address"
                      placeholder="Full residential address with Landmark"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section B: Business Information (Right Column on Desktop) */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm space-y-5 text-left h-full flex flex-col">
                <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-[#dc2626] flex items-center justify-center font-bold">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      B. Business Information
                    </h3>
                    <p className="text-xs text-slate-500">
                      Shop location, hardware capacity, and commercial credentials
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="shop_name" className="text-xs font-bold text-slate-700">
                      Shop / Store Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="shop_name"
                      placeholder="e.g. Pioneer Xerox & Digital Print Studio"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="biz_address" className="text-xs font-bold text-slate-700">
                      Business Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="biz_address"
                      placeholder="Shop No, Building Name, Street / Campus Road"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs font-bold text-slate-700">
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="city"
                      placeholder="e.g. Pune"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-bold text-slate-700">
                      State <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="state"
                      placeholder="e.g. Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pincode" className="text-xs font-bold text-slate-700">
                      PIN Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pincode"
                      placeholder="e.g. 411001"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="biz_type" className="text-xs font-bold text-slate-700">
                      Business Type
                    </Label>
                    <select
                      id="biz_type"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-neutral-300 text-xs bg-white focus:border-[#dc2626] focus:outline-none"
                    >
                      <option value="Reprography / Xerox">Reprography / Xerox Center</option>
                      <option value="Campus Print Shop">College / Campus Print Shop</option>
                      <option value="Commercial Offset">Commercial Offset & Digital Press</option>
                      <option value="Photo Studio & Color Lab">Photo Studio & Color Lab</option>
                      <option value="Stationery Store">Stationery & General Printing</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gst" className="text-xs font-bold text-slate-700">
                      GST Number (Optional)
                    </Label>
                    <Input
                      id="gst"
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      maxLength={15}
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="h-11 rounded-xl text-xs uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="package" className="text-xs font-bold text-slate-700">
                      Selected Pricing Plan
                    </Label>
                    <select
                      id="package"
                      value={selectedPackage}
                      onChange={(e) => setSelectedPackage(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-neutral-300 text-xs bg-white focus:border-[#dc2626] focus:outline-none font-bold text-[#dc2626]"
                    >
                      <option value="Starter Print Plan">Starter Print Plan (₹2,000 / 30 Days)</option>
                      <option value="Pro Shop Plan">Pro Shop Plan (₹5,000 / 30 Days)</option>
                      <option value="Enterprise Hub Plan">Enterprise Hub Plan (₹8,000 / 30 Days)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action: Centered Button Below Both Columns */}
            <div className="pt-4 flex flex-col items-center justify-center max-w-md mx-auto text-center">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-14 bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#b91c1c] hover:to-[#991b1b] text-white font-bold text-base rounded-full shadow-xl shadow-red-500/25 transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting Partner Application...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Shopkeeper Application</span>
                    <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-slate-400 mt-3">
                By submitting this application, you agree to printOn24 Merchant Terms and platform privacy policies.
              </p>
            </div>
          </form>
        )}
      </main>

      <PublicFooter />
    </div>
  );
};

export default EnquiryPage;
