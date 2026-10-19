ALTER TABLE public.print_shops ADD COLUMN opening_hours text;
NOTIFY pgrst, 'reload schema';