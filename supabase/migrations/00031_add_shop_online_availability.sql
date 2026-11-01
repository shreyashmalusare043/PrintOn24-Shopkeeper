ALTER TABLE public.print_shops
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.resolve_shop_by_qr(p_code text)
RETURNS TABLE (
  shop_id text,
  shop_name text,
  shop_city text,
  shop_code text,
  is_open boolean,
  terminal_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id AS shop_id,
    ps.name AS shop_name,
    ps.city AS shop_city,
    COALESCE(ps.shop_code, ps.terminal_code) AS shop_code,
    ps.is_open,
    ps.terminal_code
  FROM public.print_shops ps
  LEFT JOIN public.shop_qrs sq ON sq.shop_id = ps.id
  WHERE COALESCE(ps.is_online, true)
    AND (
      UPPER(TRIM(ps.shop_code)) = UPPER(TRIM(p_code))
      OR UPPER(TRIM(ps.terminal_code)) = UPPER(TRIM(p_code))
      OR UPPER(TRIM(sq.shop_code)) = UPPER(TRIM(p_code))
      OR UPPER(TRIM(ps.id)) = UPPER(TRIM(p_code))
    )
  LIMIT 1;
END;
$$;
