CREATE OR REPLACE VIEW shop_feedback AS 
SELECT 
  id,
  user_id,
  user_name,
  rating,
  category,
  feedback_text,
  feedback_text as comment,
  created_at,
  shop_id,
  target_type,
  moderation_status,
  (moderation_status = 'approved') as is_accepted
FROM app_feedback;