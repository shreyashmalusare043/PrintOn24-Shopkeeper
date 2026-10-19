CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopkeeper_id text NOT NULL,
  shop_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  device_info text,
  ip_address text,
  user_agent text,
  last_used_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token ON trusted_devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_shopkeeper ON trusted_devices(shopkeeper_id);

CREATE TABLE IF NOT EXISTS shopkeeper_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON shopkeeper_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON shopkeeper_password_resets(email);

ALTER TABLE shopkeeper_settings ADD COLUMN IF NOT EXISTS pinned_order_ids text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_print_orders_shop_created ON print_orders (shop_id, created_at DESC);