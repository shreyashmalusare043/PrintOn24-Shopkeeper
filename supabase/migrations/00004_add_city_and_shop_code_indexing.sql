ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS city text DEFAULT 'Pune';
CREATE INDEX IF NOT EXISTS idx_shop_qrs_shop_code ON shop_qrs (shop_code);
CREATE INDEX IF NOT EXISTS idx_shop_qrs_shop_id ON shop_qrs (shop_id);
CREATE INDEX IF NOT EXISTS idx_print_shops_city ON print_shops (city);
CREATE INDEX IF NOT EXISTS idx_shopkeeper_accounts_email ON shopkeeper_accounts (email);
CREATE INDEX IF NOT EXISTS idx_shopkeeper_accounts_shop_id ON shopkeeper_accounts (shop_id);