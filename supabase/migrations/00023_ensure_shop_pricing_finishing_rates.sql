ALTER TABLE shop_pricing
  ADD COLUMN IF NOT EXISTS urgent_surcharge numeric DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS binding_rate numeric DEFAULT 30.0,
  ADD COLUMN IF NOT EXISTS lamination_rate numeric DEFAULT 20.0;
