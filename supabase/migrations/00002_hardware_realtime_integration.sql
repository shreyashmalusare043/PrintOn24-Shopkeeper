-- 1. Enhance shop_pcs with real hardware heartbeat & OS fields
ALTER TABLE public.shop_pcs 
ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_current_pc boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS os_info text DEFAULT 'Windows 11 Pro 64-bit',
ADD COLUMN IF NOT EXISTS agent_version text DEFAULT '1.2.0';

-- 2. Enhance shop_printers with PC mapping, hardware ID, and real-time status
ALTER TABLE public.shop_printers 
ADD COLUMN IF NOT EXISTS pc_id text,
ADD COLUMN IF NOT EXISTS hardware_id text,
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS usage_type text DEFAULT 'All',
ADD COLUMN IF NOT EXISTS is_color boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_duplex boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS paper_types jsonb DEFAULT '["Standard 75 GSM", "Bond Paper", "Glossy"]'::jsonb,
ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- Update existing shop_printers to map to default PC if pc_id is null
UPDATE public.shop_printers 
SET pc_id = 'pc_01', hardware_id = 'HW_PRN_' || substr(id, 5)
WHERE pc_id IS NULL;

-- 3. Create print_jobs table for physical hardware spooling & execution tracking
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id text PRIMARY KEY,
  order_id text REFERENCES public.print_orders(id) ON DELETE SET NULL,
  shop_id text NOT NULL,
  pc_id text NOT NULL,
  printer_id text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  copies integer DEFAULT 1,
  color_mode text DEFAULT 'B&W',
  duplex text DEFAULT 'Single Side',
  paper_size text DEFAULT 'A4',
  paper_type text DEFAULT 'Standard 75 GSM',
  page_count integer DEFAULT 1,
  total_price numeric DEFAULT 0,
  status text DEFAULT 'Queued',
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS on print_jobs
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on print_jobs"
ON public.print_jobs FOR SELECT USING (true);

CREATE POLICY "Allow public insert on print_jobs"
ON public.print_jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on print_jobs"
ON public.print_jobs FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on print_jobs"
ON public.print_jobs FOR DELETE USING (true);

-- Enable Realtime publication for tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'shop_pcs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_pcs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'shop_printers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_printers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'print_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'print_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
  END IF;
END $$;
