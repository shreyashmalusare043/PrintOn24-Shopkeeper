-- Create shopkeeper accounts
CREATE TABLE IF NOT EXISTS shopkeeper_accounts (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  owner_name text NOT NULL,
  phone text,
  role text DEFAULT 'shopkeeper',
  created_at timestamptz DEFAULT now()
);

-- Create shop PCs
CREATE TABLE IF NOT EXISTS shop_pcs (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  pc_name text NOT NULL,
  pc_code text NOT NULL,
  is_default boolean DEFAULT false,
  status text DEFAULT 'online',
  ip_address text DEFAULT '192.168.1.101',
  qr_code_data text,
  created_at timestamptz DEFAULT now()
);

-- Create shop printers
CREATE TABLE IF NOT EXISTS shop_printers (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  name text NOT NULL,
  model text,
  connection_type text DEFAULT 'usb',
  status text DEFAULT 'online',
  capabilities jsonb DEFAULT '{"color": true, "bw": true, "single_side": true, "double_side": true}'::jsonb,
  paper_sizes jsonb DEFAULT '["A4", "A3"]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create shop pricing
CREATE TABLE IF NOT EXISTS shop_pricing (
  id text PRIMARY KEY,
  shop_id text UNIQUE NOT NULL,
  color_single numeric DEFAULT 5.0,
  bw_single numeric DEFAULT 2.0,
  color_double numeric DEFAULT 8.0,
  bw_double numeric DEFAULT 3.0,
  a4_rate numeric DEFAULT 0.0,
  a3_rate numeric DEFAULT 10.0,
  bond_rate numeric DEFAULT 5.0,
  glossy_rate numeric DEFAULT 15.0,
  updated_at timestamptz DEFAULT now()
);

-- Create shop page reminders
CREATE TABLE IF NOT EXISTS shop_reminders (
  id text PRIMARY KEY,
  shop_id text UNIQUE NOT NULL,
  page_threshold integer DEFAULT 2000,
  current_print_count integer DEFAULT 0,
  last_reminded_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  last_status text DEFAULT 'idle',
  updated_at timestamptz DEFAULT now()
);

-- Create shop reminder logs
CREATE TABLE IF NOT EXISTS shop_reminder_logs (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  threshold integer NOT NULL,
  print_count integer NOT NULL,
  action text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  shop_name text NOT NULL,
  category text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'open',
  admin_response text,
  attachment_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create platform policies
CREATE TABLE IF NOT EXISTS platform_policies (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  version text DEFAULT 'v2.1',
  published_at timestamptz DEFAULT now()
);

-- Create platform terms
CREATE TABLE IF NOT EXISTS platform_terms (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  version text DEFAULT 'v2.4',
  published_at timestamptz DEFAULT now()
);

-- Create shop subscriptions
CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id text PRIMARY KEY,
  shop_id text UNIQUE NOT NULL,
  plan_id text NOT NULL DEFAULT 'pro',
  plan_name text NOT NULL DEFAULT 'Pro Shop Plan',
  price numeric DEFAULT 499.0,
  pc_limit integer DEFAULT 3,
  validity_days integer DEFAULT 30,
  start_date timestamptz DEFAULT now(),
  expiry_date timestamptz DEFAULT (now() + interval '30 days'),
  status text DEFAULT 'active',
  auto_renew boolean DEFAULT true
);

-- Create shopkeeper settings
CREATE TABLE IF NOT EXISTS shopkeeper_settings (
  id text PRIMARY KEY,
  shop_id text UNIQUE NOT NULL,
  theme_mode text DEFAULT 'dark',
  color_theme text DEFAULT 'orange',
  language text DEFAULT 'en',
  updated_at timestamptz DEFAULT now()
);

-- Ensure print_orders has target_pc columns
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS target_pc_id text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS target_pc_name text;

-- Ensure print_shops has extra columns
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS membership_enabled boolean DEFAULT true;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS membership_price numeric DEFAULT 99.0;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS membership_validity_days integer DEFAULT 30;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '["Xerox", "Color Printing", "Spiral Binding", "Lamination", "Document Scanning", "Photo Glossy Print"]'::jsonb;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS banner_url text;

-- Ensure user_memberships has shop_id
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS shop_id text DEFAULT 'ent-02';
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS user_name text DEFAULT 'Student Customer';
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS user_phone text DEFAULT '+91 98765 43210';
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS user_email text DEFAULT 'student@campus.edu';

-- Enable RLS and create full policies for new tables
ALTER TABLE shopkeeper_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shopkeeper_accounts" ON shopkeeper_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shop_pcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shop_pcs" ON shop_pcs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shop_printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shop_printers" ON shop_printers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shop_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shop_pricing" ON shop_pricing FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shop_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shop_reminders" ON shop_reminders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shop_reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shop_reminder_logs" ON shop_reminder_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_support_tickets" ON support_tickets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE platform_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_platform_policies" ON platform_policies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE platform_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_platform_terms" ON platform_terms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shop_subscriptions" ON shop_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE shopkeeper_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_shopkeeper_settings" ON shopkeeper_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
