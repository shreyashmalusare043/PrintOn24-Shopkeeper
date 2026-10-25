ALTER TABLE shop_pricing
  ADD COLUMN IF NOT EXISTS bw_pricing_mode text NOT NULL DEFAULT 'print',
  ADD COLUMN IF NOT EXISTS color_pricing_mode text NOT NULL DEFAULT 'print';
