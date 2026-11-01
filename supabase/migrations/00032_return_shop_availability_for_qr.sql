DROP FUNCTION IF EXISTS public.resolve_shop_by_qr(text);

CREATE FUNCTION public.resolve_shop_by_qr(p_code text)
RETURNS TABLE (
  shop_id text,
  shop_name text,
  shop_city text,
  shop_code text,
  is_open boolean,
  terminal_code text,
  is_online boolean
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
    ps.terminal_code,
    COALESCE(ps.is_online, true) AS is_online
  FROM public.print_shops ps
  LEFT JOIN public.shop_qrs sq ON sq.shop_id = ps.id
  WHERE
    UPPER(TRIM(ps.shop_code)) = UPPER(TRIM(p_code))
    OR UPPER(TRIM(ps.terminal_code)) = UPPER(TRIM(p_code))
    OR UPPER(TRIM(sq.shop_code)) = UPPER(TRIM(p_code))
    OR UPPER(TRIM(ps.id)) = UPPER(TRIM(p_code))
  LIMIT 1;
END;
$$;
