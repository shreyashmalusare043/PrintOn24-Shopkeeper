ALTER TABLE user_memberships 
  ADD COLUMN IF NOT EXISTS fee_paid numeric
    DEFAULT 199,
  ADD COLUMN IF NOT EXISTS billing_cycle text
    DEFAULT 'Monthly'; ALTER TABLE shop_pricing 
  ADD COLUMN IF NOT EXISTS membership_billing_cycle text
    DEFAULT 'Monthly'; ALTER TABLE print_shops 
  ADD COLUMN IF NOT EXISTS operating_hours jsonb
    DEFAULT '{"monday":"09:00 - 21:00","tuesday":"09:00 - 21:00","wednesday":"09:00 - 21:00","thursday":"09:00 - 21:00","friday":"09:00 - 21:00","saturday":"09:00 - 20:00","sunday":"Closed"}'::jsonb,
  ADD COLUMN IF NOT EXISTS closed_days jsonb
    DEFAULT '["Sunday"]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment jsonb
    DEFAULT '["Canon imageRUNNER ADVANCE","HP LaserJet Enterprise","Epson EcoTank L805"]'::jsonb; ALTER TABLE shop_reminders 
  ADD COLUMN IF NOT EXISTS printer_id text,
  ADD COLUMN IF NOT EXISTS purpose text
    DEFAULT 'Toner Yield Alert',
  ADD COLUMN IF NOT EXISTS page_count_limit int
    DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS warning_threshold int
    DEFAULT 200,
  ADD COLUMN IF NOT EXISTS cycle_history jsonb
    DEFAULT '[]'::jsonb; ALTER TABLE support_tickets 
  ADD COLUMN IF NOT EXISTS messages jsonb
    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_contact text; ALTER TABLE user_consents 
  ADD COLUMN IF NOT EXISTS shop_id text,
  ADD COLUMN IF NOT EXISTS owner_id text,
  ADD COLUMN IF NOT EXISTS accepted boolean
    DEFAULT true; ALTER TABLE shop_subscriptions 
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS payment_status text
    DEFAULT 'completed';