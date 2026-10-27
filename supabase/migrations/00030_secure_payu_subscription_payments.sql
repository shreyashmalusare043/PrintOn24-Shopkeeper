ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subscription_plan_id text,
  ADD COLUMN IF NOT EXISTS subscription_duration_days integer,
  ADD COLUMN IF NOT EXISTS subscription_pc_limit integer;

CREATE OR REPLACE FUNCTION public.create_payu_transaction(
  p_user_id text,
  p_shop_id text,
  p_order_id text,
  p_amount numeric,
  p_product_info text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Create PayU transactions through the payu-payment Edge Function.';
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_payu_payment(
  p_txnid text,
  p_mihpayid text,
  p_status text,
  p_order_id text,
  p_shop_id text,
  p_amount numeric,
  p_user_id text,
  p_membership_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Verify PayU payments through the payu-payment Edge Function.';
END;
$$;

REVOKE ALL ON FUNCTION public.create_payu_transaction(text, text, text, numeric, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_payu_payment(text, text, text, text, text, numeric, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_payu_subscription(
  p_txnid text,
  p_mihpayid text,
  p_bank_ref_num text,
  p_unmappedstatus text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment record;
  v_subscription_id text;
  v_start timestamptz := now();
BEGIN
  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE payu_txnid = p_txnid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PayU transaction was not found.';
  END IF;

  IF v_payment.payment_status = 'PAID' AND v_payment.hash_verified THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  IF v_payment.subscription_plan_id IS NULL
     OR v_payment.subscription_duration_days IS NULL
     OR v_payment.subscription_pc_limit IS NULL
     OR v_payment.subscription_duration_days < 1
     OR v_payment.subscription_pc_limit < 1 THEN
    RAISE EXCEPTION 'PayU subscription transaction is incomplete.';
  END IF;

  UPDATE public.payments
  SET payu_mihpayid = p_mihpayid,
      payment_status = 'PAID',
      hash_verified = true,
      bank_ref_num = NULLIF(p_bank_ref_num, ''),
      unmappedstatus = NULLIF(p_unmappedstatus, ''),
      paid_at = v_start,
      updated_at = v_start
  WHERE id = v_payment.id;

  SELECT id
  INTO v_subscription_id
  FROM public.shop_subscriptions
  WHERE shop_id = v_payment.shop_id
  ORDER BY start_date DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_subscription_id IS NULL THEN
    v_subscription_id := 'sub_' || v_payment.shop_id;
    INSERT INTO public.shop_subscriptions (
      id, shop_id, plan_id, plan_name, price, pc_limit, validity_days,
      start_date, expiry_date, status, auto_renew, payment_id, order_id, payment_status
    )
    SELECT
      v_subscription_id, v_payment.shop_id, v_payment.subscription_plan_id, plan.name,
      v_payment.amount, v_payment.subscription_pc_limit, v_payment.subscription_duration_days,
      v_start, v_start + make_interval(days => v_payment.subscription_duration_days),
      'active', true, p_mihpayid, v_payment.order_id, 'completed'
    FROM public.subscription_plans AS plan
    WHERE plan.id = v_payment.subscription_plan_id;
  ELSE
    UPDATE public.shop_subscriptions AS subscription
    SET plan_id = v_payment.subscription_plan_id,
        plan_name = plan.name,
        price = v_payment.amount,
        pc_limit = v_payment.subscription_pc_limit,
        validity_days = v_payment.subscription_duration_days,
        start_date = v_start,
        expiry_date = v_start + make_interval(days => v_payment.subscription_duration_days),
        status = 'active',
        auto_renew = true,
        payment_id = p_mihpayid,
        order_id = v_payment.order_id,
        payment_status = 'completed'
    FROM public.subscription_plans AS plan
    WHERE subscription.id = v_subscription_id
      AND plan.id = v_payment.subscription_plan_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription plan was not found while activating payment.';
  END IF;

  UPDATE public.print_shops
  SET pc_limit = v_payment.subscription_pc_limit
  WHERE id = v_payment.shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop was not found while activating payment.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'txnid', p_txnid,
    'shop_id', v_payment.shop_id,
    'plan_id', v_payment.subscription_plan_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_payu_subscription(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payu_subscription(text, text, text, text)
  TO service_role;
