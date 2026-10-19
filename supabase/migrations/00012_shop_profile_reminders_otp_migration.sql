-- Add missing fields to print_shops (additive, backward-compatible)
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE print_shops ADD COLUMN IF NOT EXISTS landmark TEXT;

-- Enhance admin_otps for shop-level isolation
ALTER TABLE admin_otps ADD COLUMN IF NOT EXISTS shop_id TEXT;

-- Enhance shop_reminders for printer ink/toner tracking
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS printer_name TEXT;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS print_mode TEXT DEFAULT 'both';
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS bw_limit INTEGER DEFAULT 1000;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS color_limit INTEGER DEFAULT 500;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS bw_printed_count INTEGER DEFAULT 0;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS color_printed_count INTEGER DEFAULT 0;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS bw_threshold INTEGER DEFAULT 50;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS color_threshold INTEGER DEFAULT 50;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS cartridge_notes TEXT;
ALTER TABLE shop_reminders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Enhance shop_reminder_logs
ALTER TABLE shop_reminder_logs ADD COLUMN IF NOT EXISTS reminder_id TEXT;
ALTER TABLE shop_reminder_logs ADD COLUMN IF NOT EXISTS printer_name TEXT;
ALTER TABLE shop_reminder_logs ADD COLUMN IF NOT EXISTS counter_type TEXT DEFAULT 'all';
ALTER TABLE shop_reminder_logs ADD COLUMN IF NOT EXISTS prints_done INTEGER DEFAULT 0;
ALTER TABLE shop_reminder_logs ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ DEFAULT NOW();