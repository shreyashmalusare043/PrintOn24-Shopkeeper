-- 1. Ensure shop_printers has updated_at and default ID
ALTER TABLE shop_printers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE shop_printers ALTER COLUMN id SET DEFAULT ('prn_' || substr(md5(random()::text), 1, 14));

-- 2. Ensure print_shops has shop_code column
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS shop_code TEXT;

-- 3. Synchronize existing shop_code from terminal_code or shop_qrs
UPDATE print_shops 
SET shop_code = COALESCE(terminal_code, (SELECT shop_code FROM shop_qrs WHERE shop_id = print_shops.id LIMIT 1))
WHERE shop_code IS NULL;

-- Also update terminal_code if missing
UPDATE print_shops
SET terminal_code = shop_code
WHERE terminal_code IS NULL AND shop_code IS NOT NULL;

-- 4. Create performance and lookup indexes for User Panel verification
CREATE INDEX IF NOT EXISTS idx_print_shops_shop_code ON print_shops (shop_code);
CREATE INDEX IF NOT EXISTS idx_print_shops_terminal_code ON print_shops (terminal_code);
CREATE INDEX IF NOT EXISTS idx_shop_qrs_shop_code ON shop_qrs (shop_code);
CREATE INDEX IF NOT EXISTS idx_shop_printers_shop_id ON shop_printers (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_printers_pc_id ON shop_printers (pc_id);

-- 5. Helper function for User Panel to validate and resolve shop by QR code
CREATE OR REPLACE FUNCTION resolve_shop_by_qr(p_code TEXT)
RETURNS TABLE (
  shop_id TEXT,
  shop_name TEXT,
  shop_city TEXT,
  shop_code TEXT,
  is_open BOOLEAN,
  terminal_code TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
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
  FROM print_shops ps
  LEFT JOIN shop_qrs sq ON sq.shop_id = ps.id
  WHERE UPPER(TRIM(ps.shop_code)) = UPPER(TRIM(p_code))
     OR UPPER(TRIM(ps.terminal_code)) = UPPER(TRIM(p_code))
     OR UPPER(TRIM(sq.shop_code)) = UPPER(TRIM(p_code))
     OR UPPER(TRIM(ps.id)) = UPPER(TRIM(p_code))
  LIMIT 1;
END;
$$;
