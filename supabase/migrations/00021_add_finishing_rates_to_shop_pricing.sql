ALTER TABLE shop_pricing 
  ADD COLUMN urgent_surcharge numeric DEFAULT 5.0,
  ADD COLUMN binding_rate numeric DEFAULT 30.0,
  ADD COLUMN lamination_rate numeric DEFAULT 20.0;
