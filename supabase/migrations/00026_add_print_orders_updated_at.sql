ALTER TABLE public.print_orders
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
