import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { PublicFooter } from '@/components/public/PublicFooter';

type ResolvedShop = {
  shop_id: string;
};

export const QrShopRedirectPage: React.FC = () => {
  const { shopCode = '' } = useParams<{ shopCode: string }>();
  const [message, setMessage] = useState('Finding this PrintOn24 shop...');

  useEffect(() => {
    let isCurrent = true;

    const resolveShopAndRedirect = async () => {
      const code = shopCode.trim();
      if (!code || code.length > 100) {
        setMessage('This shop QR code is invalid. Please scan the QR code again or ask the shop for help.');
        return;
      }

      const { data, error } = await supabase.rpc('resolve_shop_by_qr', { p_code: code });
      if (!isCurrent) return;
      if (error) {
        console.error('Failed to resolve shop QR code:', error);
        setMessage('We could not look up this shop right now. Please try again or ask the shop for help.');
        return;
      }

      const shop = (Array.isArray(data) ? data[0] : data) as ResolvedShop | null;
      if (!shop?.shop_id) {
        setMessage('This shop QR code could not be found. Please ask the shop for an updated QR code.');
        return;
      }

      const uploadUrl = new URL('https://printon24.in/upload');
      uploadUrl.searchParams.set('shop_code', code.toUpperCase());
      window.location.replace(uploadUrl.toString());
    };

    void resolveShopAndRedirect();
    return () => {
      isCurrent = false;
    };
  }, [shopCode]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans">
      <PublicNavbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[#dc2626]">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold">Connecting to your shop</h1>
          <p className="mt-3 text-sm text-slate-600" role="status">{message}</p>
          <p className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            Shop code: {shopCode}
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};

export default QrShopRedirectPage;
