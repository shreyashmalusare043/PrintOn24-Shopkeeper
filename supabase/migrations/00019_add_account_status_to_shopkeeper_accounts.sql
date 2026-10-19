ALTER TABLE shopkeeper_accounts 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shopkeeper_accounts_status ON shopkeeper_accounts(status);
CREATE INDEX IF NOT EXISTS idx_shopkeeper_accounts_is_active ON shopkeeper_accounts(is_active);
