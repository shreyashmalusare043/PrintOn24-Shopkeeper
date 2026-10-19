DROP INDEX IF EXISTS shop_reminders_shop_printer_idx;

-- Standardize any existing row whose id doesn't match rem_ + printer_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, printer_id FROM shop_reminders WHERE printer_id IS NOT NULL AND id != 'rem_' || printer_id LOOP
    -- Delete any dangling duplicate if rem_ + printer_id already exists
    IF EXISTS (SELECT 1 FROM shop_reminders WHERE id = 'rem_' || r.printer_id) THEN
      DELETE FROM shop_reminders WHERE id = r.id;
    ELSE
      UPDATE shop_reminders SET id = 'rem_' || r.printer_id WHERE id = r.id;
    END IF;
  END LOOP;
END $$;