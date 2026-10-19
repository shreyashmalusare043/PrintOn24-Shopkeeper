-- 1. Create Upload_Document view with "Preview Url" column
CREATE OR REPLACE VIEW "Upload_Document" AS 
SELECT 
  id, 
  order_id, 
  shop_id, 
  user_id, 
  preview_url AS "Preview Url", 
  preview_url, 
  file_name, 
  file_type, 
  file_size_mb, 
  storage_path, 
  storage_bucket, 
  created_at 
FROM uploaded_documents;

-- 2. Ensure print_shops and shop_pricing have membership fields
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS membership_discount_percent integer DEFAULT 15;
ALTER TABLE shop_pricing ADD COLUMN IF NOT EXISTS membership_enabled boolean DEFAULT true;
ALTER TABLE shop_pricing ADD COLUMN IF NOT EXISTS membership_monthly_fee numeric DEFAULT 99;
ALTER TABLE shop_pricing ADD COLUMN IF NOT EXISTS membership_discount_percent integer DEFAULT 15;
