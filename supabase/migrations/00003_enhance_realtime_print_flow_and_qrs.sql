-- Add necessary columns to print_orders
ALTER TABLE public.print_orders 
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS page_range text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS shop_code text;

-- Create dynamic shop QR codes table
CREATE TABLE IF NOT EXISTS public.shop_qrs (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  pc_id text,
  qr_name text NOT NULL,
  shop_code text NOT NULL UNIQUE,
  qr_data text NOT NULL,
  target_url text NOT NULL,
  is_active boolean DEFAULT true,
  scan_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on shop_qrs
ALTER TABLE public.shop_qrs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shop_qrs' AND policyname = 'allow_all_shop_qrs'
  ) THEN
    CREATE POLICY allow_all_shop_qrs ON public.shop_qrs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Enable Realtime publication for shop_qrs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'shop_qrs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_qrs;
  END IF;
END $$;
