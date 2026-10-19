ALTER TABLE notifications 
  ADD COLUMN recipient_email text;

ALTER TABLE notifications 
  ALTER COLUMN id SET DEFAULT ('notif_' || gen_random_uuid()::text);