ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE shop_pricing ADD COLUMN IF NOT EXISTS dynamic_paper_types JSONB DEFAULT '[]'::jsonb;
ALTER TABLE shopkeeper_settings ADD COLUMN IF NOT EXISTS dynamic_paper_types JSONB DEFAULT '[]'::jsonb;
