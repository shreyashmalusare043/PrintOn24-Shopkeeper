ALTER TABLE public.shop_pcs
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS is_current_pc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS os_info text DEFAULT 'Windows 11 Pro 64-bit',
  ADD COLUMN IF NOT EXISTS agent_version text DEFAULT '1.2.0',
  ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.shop_pcs
SET last_heartbeat = created_at
WHERE last_heartbeat IS NULL
  AND created_at IS NOT NULL;
