ALTER TABLE shop_pricing
  ADD COLUMN IF NOT EXISTS short_page_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bw_short_page_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS color_short_page_rate numeric NOT NULL DEFAULT 0;
