ALTER TABLE public.print_shops
  ADD COLUMN IF NOT EXISTS opening_hours text;

NOTIFY pgrst, 'reload schema';
