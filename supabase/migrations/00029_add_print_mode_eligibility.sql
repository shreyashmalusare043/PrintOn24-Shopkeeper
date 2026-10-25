ALTER TABLE shop_pricing
  ADD COLUMN IF NOT EXISTS eligible_bw_single boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_bw_back_to_back boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_color_single boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_color_back_to_back boolean NOT NULL DEFAULT true;

ALTER TABLE shop_dynamic_paper_types
  ADD COLUMN IF NOT EXISTS eligible_bw_single boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_bw_back_to_back boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_color_single boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_color_back_to_back boolean NOT NULL DEFAULT true;
