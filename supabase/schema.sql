-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: cleanup_expired_print_documents(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."cleanup_expired_print_documents"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer := 0;
  v_files jsonb := '[]'::jsonb;
BEGIN
  -- 1. Identify all expired documents
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'bucket', storage_bucket,
    'path', storage_path
  )), '[]'::jsonb)
  INTO v_files
  FROM public.uploaded_documents
  WHERE expiry_at <= now() 
    AND upload_status != 'FILE_DELETED';

  -- 2. Update status in uploaded_documents without direct deletion from storage.objects
  UPDATE public.uploaded_documents
  SET 
    upload_status = 'FILE_DELETED',
    deleted_at = now()
  WHERE expiry_at <= now() 
    AND upload_status != 'FILE_DELETED';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cleaned_count', v_count,
    'expired_files', v_files,
    'executed_at', now()
  );
END;
$$;


--
-- Name: create_payu_transaction("text", "text", "text", numeric, "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."create_payu_transaction"("p_user_id" "text", "p_shop_id" "text", "p_order_id" "text", "p_amount" numeric, "p_product_info" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_key text := 'nD7EiA';
  v_salt text := '9zvMlieMhahQa81Y2Y1EGoQlhPBmR9pf';
  v_txnid text;
  v_hash_string text;
  v_hash text;
  v_shop_name text := '';
  v_shop_upi text := '';
  v_shop_bank text := '';
BEGIN
  v_txnid := 'TXN_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 9000 + 1000)::text;

  SELECT name, COALESCE(upi_id, ''), COALESCE(bank_account_no, '')
  INTO v_shop_name, v_shop_upi, v_shop_bank
  FROM public.print_shops
  WHERE id = p_shop_id;

  -- PayU hash format: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
  -- udf1 = shop_id, udf2 = user_id, udf3 = order_id
  v_hash_string := v_key || '|' || v_txnid || '|' || trim(to_char(p_amount, 'FM999999990.00')) || '|' ||
                   p_product_info || '|' || COALESCE(p_customer_name, 'Customer') || '|' ||
                   COALESCE(p_customer_email, 'customer@printon24.io') || '|' ||
                   p_shop_id || '|' || p_user_id || '|' || COALESCE(p_order_id, '') || '||||||||' || v_salt;

  v_hash := encode(digest(v_hash_string, 'sha512'), 'hex');

  -- Record initiated payment record
  INSERT INTO public.payments (
    id, order_id, user_id, shop_id,
    payu_txnid, payu_hash, amount, currency,
    payment_method, payment_status,
    split_settlement_info, created_at
  ) VALUES (
    'pay_' || v_txnid,
    p_order_id,
    p_user_id,
    p_shop_id,
    v_txnid,
    v_hash,
    p_amount,
    'INR',
    'PayU',
    'INITIATED',
    jsonb_build_object(
      'shop_id', p_shop_id,
      'shop_name', v_shop_name,
      'shop_upi', v_shop_upi,
      'routed_account', COALESCE(NULLIF(v_shop_upi, ''), v_shop_bank, 'Shopkeeper Primary Vault'),
      'settlement_type', 'Split Settlement'
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'key', v_key,
    'txnid', v_txnid,
    'amount', trim(to_char(p_amount, 'FM999999990.00')),
    'productinfo', p_product_info,
    'firstname', COALESCE(p_customer_name, 'Customer'),
    'email', COALESCE(p_customer_email, 'customer@printon24.io'),
    'phone', COALESCE(p_customer_phone, '9999999999'),
    'hash', v_hash,
    'udf1', p_shop_id,
    'udf2', p_user_id,
    'udf3', COALESCE(p_order_id, ''),
    'shop_name', v_shop_name,
    'routed_account', COALESCE(NULLIF(v_shop_upi, ''), v_shop_bank, 'Shopkeeper Primary Vault')
  );
END;
$$;


--
-- Name: resolve_shop_by_qr("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."resolve_shop_by_qr"("p_code" "text") RETURNS TABLE("shop_id" "text", "shop_name" "text", "shop_city" "text", "shop_code" "text", "is_open" boolean, "terminal_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id AS shop_id,
    ps.name AS shop_name,
    ps.city AS shop_city,
    COALESCE(ps.shop_code, ps.terminal_code) AS shop_code,
    ps.is_open,
    ps.terminal_code
  FROM print_shops ps
  LEFT JOIN shop_qrs sq ON sq.shop_id = ps.id
  WHERE UPPER(TRIM(ps.shop_code)) = UPPER(TRIM(p_code))
     OR UPPER(TRIM(ps.terminal_code)) = UPPER(TRIM(p_code))
     OR UPPER(TRIM(sq.shop_code)) = UPPER(TRIM(p_code))
     OR UPPER(TRIM(ps.id)) = UPPER(TRIM(p_code))
  LIMIT 1;
END;
$$;


--
-- Name: verify_payu_payment("text", "text", "text", "text", "text", numeric, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."verify_payu_payment"("p_txnid" "text", "p_mihpayid" "text", "p_status" "text", "p_order_id" "text", "p_shop_id" "text", "p_amount" numeric, "p_user_id" "text", "p_membership_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_shop record;
  v_commission numeric := 0;
  v_net_payable numeric := p_amount;
BEGIN
  -- Verify shop exists
  SELECT * INTO v_shop FROM public.print_shops WHERE id = p_shop_id;

  -- 1. Update payments table
  UPDATE public.payments
  SET 
    payu_mihpayid = p_mihpayid,
    payment_status = CASE WHEN lower(p_status) IN ('success', 'paid') THEN 'PAID' ELSE 'FAILED' END
  WHERE payu_txnid = p_txnid;

  IF NOT FOUND THEN
    INSERT INTO public.payments (
      id, order_id, user_id, shop_id,
      payu_txnid, payu_mihpayid, amount, currency,
      payment_method, payment_status, created_at
    ) VALUES (
      'pay_' || p_txnid, p_order_id, p_user_id, p_shop_id,
      p_txnid, p_mihpayid, p_amount, 'INR',
      'PayU',
      CASE WHEN lower(p_status) IN ('success', 'paid') THEN 'PAID' ELSE 'FAILED' END,
      now()
    );
  END IF;

  -- 2. If Order ID exists, update print_orders
  IF p_order_id IS NOT NULL AND p_order_id != '' THEN
    UPDATE public.print_orders
    SET 
      payment_method = 'PayU Online',
      payment_status = 'PAID',
      order_status = 'Queued',
      payu_txnid = p_txnid,
      payu_payment_id = p_mihpayid
    WHERE id = p_order_id;
  END IF;

  -- 3. Log into shop_settlements for PayU split settlement to shopkeeper
  IF lower(p_status) IN ('success', 'paid') AND p_shop_id IS NOT NULL THEN
    v_commission := round(p_amount * 0.05, 2);
    v_net_payable := p_amount - v_commission;

    INSERT INTO public.shop_settlements (
      id, shop_id, shop_name, total_orders,
      gross_amount, platform_commission, net_payable,
      settlement_cycle, status, bank_account_no, paid_at, created_at
    ) VALUES (
      'stl_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 900 + 100)::text,
      p_shop_id,
      COALESCE(v_shop.name, 'Shop Partner'),
      1,
      p_amount,
      v_commission,
      v_net_payable,
      'Instant PayU Split Settlement',
      'COMPLETED',
      COALESCE(v_shop.upi_id, v_shop.bank_account_no, 'Direct PayU Routed Account'),
      now(),
      now()
    );
  END IF;

  -- 4. If membership purchase
  IF p_membership_id IS NOT NULL AND p_membership_id != '' AND lower(p_status) IN ('success', 'paid') THEN
    UPDATE public.user_memberships
    SET 
      is_active = true,
      updated_at = now()
    WHERE id = p_membership_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'verified', lower(p_status) IN ('success', 'paid'),
    'txnid', p_txnid,
    'mihpayid', p_mihpayid,
    'order_id', p_order_id,
    'shop_id', p_shop_id,
    'status', p_status
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: uploaded_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."uploaded_documents" (
    "id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" DEFAULT 'PDF'::"text" NOT NULL,
    "file_size_mb" numeric DEFAULT 1.2,
    "total_pages" integer DEFAULT 1 NOT NULL,
    "preview_url" "text" DEFAULT ''::"text",
    "image_editing" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" "text",
    "order_id" "text",
    "original_file_name" "text",
    "mime_type" "text",
    "file_size" numeric,
    "storage_bucket" "text" DEFAULT 'print_documents'::"text",
    "storage_path" "text",
    "upload_status" "text" DEFAULT 'READY'::"text",
    "expiry_at" timestamp with time zone DEFAULT ("now"() + '12:00:00'::interval),
    "deleted_at" timestamp with time zone,
    "print_config" "jsonb" DEFAULT '{}'::"jsonb",
    "converted_pdf_url" "text",
    "original_file_url" "text",
    "excel_sheets" "jsonb",
    "excel_scaling" "text" DEFAULT 'No Scaling'::"text",
    "conversion_service" "text" DEFAULT 'Gotenberg-LibreOffice'::"text"
);


--
-- Name: Upload_Document; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."Upload_Document" AS
 SELECT "id",
    "user_id",
    "shop_id",
    "order_id",
    "file_name",
    "original_file_name",
    "file_type",
    "file_size",
    "file_size_mb",
    "total_pages",
    "storage_bucket",
    "storage_path",
    "preview_url",
    "converted_pdf_url",
    "original_file_url",
    "upload_status",
    "excel_sheets",
    "excel_scaling",
    "conversion_service",
    "print_config",
    "image_editing",
    "created_at",
    "expiry_at",
    "deleted_at"
   FROM "public"."uploaded_documents";


--
-- Name: ad_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ad_requests" (
    "id" "text" NOT NULL,
    "business_name" "text" NOT NULL,
    "contact_person" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "ad_type" "text" DEFAULT 'Banner'::"text" NOT NULL,
    "budget" "text" DEFAULT ''::"text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: admin_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."admin_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "otp_code" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_used" boolean DEFAULT false NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "shop_id" "text"
);


--
-- Name: app_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."app_feedback" (
    "id" "text" NOT NULL,
    "user_id" "text" DEFAULT ''::"text",
    "user_name" "text" NOT NULL,
    "rating" integer DEFAULT 5 NOT NULL,
    "category" "text" DEFAULT 'General'::"text" NOT NULL,
    "feedback_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" "text",
    "target_type" "text" DEFAULT 'app'::"text",
    "moderation_status" "text" DEFAULT 'approved'::"text"
);


--
-- Name: career_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."career_applications" (
    "id" "text" NOT NULL,
    "career_id" "text" NOT NULL,
    "user_id" "text",
    "applicant_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "portfolio_url" "text",
    "resume_filename" "text",
    "cover_note" "text",
    "status" "text" DEFAULT 'Submitted'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: careers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."careers" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "department" "text" NOT NULL,
    "location" "text" NOT NULL,
    "type" "text" DEFAULT 'Full-time'::"text" NOT NULL,
    "experience" "text" NOT NULL,
    "description" "text" NOT NULL,
    "requirements" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: cms_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."cms_content" (
    "id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "content" "text",
    "image_url" "text",
    "link_url" "text",
    "target_audience" "text" DEFAULT 'all'::"text",
    "badge_text" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'Unread'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: home_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."home_banners" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "image_url" "text" NOT NULL,
    "button_text" "text" DEFAULT 'Print Now'::"text" NOT NULL,
    "button_link" "text" DEFAULT '/upload'::"text" NOT NULL,
    "display_order" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer DEFAULT 1,
    "description" "text",
    "destination_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: informational_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."informational_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "last_published_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "meta_description" "text" DEFAULT ''::"text"
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "text" DEFAULT ('notif_'::"text" || ("gen_random_uuid"())::"text") NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "order_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "recipient_email" "text"
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "razorpay_order_id" "text",
    "razorpay_payment_id" "text",
    "razorpay_signature" "text",
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text",
    "payment_method" "text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payu_txnid" "text",
    "payu_mihpayid" "text",
    "payu_hash" "text",
    "split_settlement_info" "jsonb",
    "bank_ref_num" "text",
    "unmappedstatus" "text",
    "error" "text",
    "error_message" "text",
    "hash_verified" boolean DEFAULT false,
    "raw_response" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "paid_at" timestamp with time zone,
    "payment_mode" "text"
);


--
-- Name: platform_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."platform_policies" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "version" "text" DEFAULT 'v2.1'::"text",
    "published_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "text" NOT NULL,
    "commission_rate" numeric DEFAULT 5.0,
    "razorpay_enabled" boolean DEFAULT true,
    "pay_on_counter_enabled" boolean DEFAULT true,
    "payu_enabled" boolean DEFAULT true,
    "payout_cycle_days" integer DEFAULT 2,
    "min_payout_amount" numeric DEFAULT 500,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "maintenance_mode" boolean DEFAULT false,
    "new_shop_registrations_open" boolean DEFAULT true,
    "auto_settlement_enabled" boolean DEFAULT true,
    "vip_discount_system_active" boolean DEFAULT true,
    "ad_sponsorship_slots_open" boolean DEFAULT true,
    "live_file_upload_enabled" boolean DEFAULT true
);


--
-- Name: platform_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."platform_terms" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "version" "text" DEFAULT 'v2.4'::"text",
    "published_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


--
-- Name: print_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."print_jobs" (
    "id" "text" NOT NULL,
    "order_id" "text",
    "shop_id" "text" NOT NULL,
    "pc_id" "text" NOT NULL,
    "printer_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text",
    "copies" integer DEFAULT 1,
    "color_mode" "text" DEFAULT 'B&W'::"text",
    "duplex" "text" DEFAULT 'Single Side'::"text",
    "paper_size" "text" DEFAULT 'A4'::"text",
    "paper_type" "text" DEFAULT 'Standard 75 GSM'::"text",
    "page_count" integer DEFAULT 1,
    "total_price" numeric DEFAULT 0,
    "status" "text" DEFAULT 'Queued'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


--
-- Name: print_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."print_orders" (
    "id" "text" NOT NULL,
    "order_number" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "token_number" "text" NOT NULL,
    "document_name" "text" NOT NULL,
    "file_type" "text" DEFAULT 'PDF'::"text" NOT NULL,
    "total_pages" integer DEFAULT 1 NOT NULL,
    "config_copies" integer DEFAULT 1 NOT NULL,
    "config_page_size" "text" DEFAULT 'A4'::"text" NOT NULL,
    "config_paper_type" "text" DEFAULT 'Normal'::"text" NOT NULL,
    "config_print_type" "text" DEFAULT 'Black & White'::"text" NOT NULL,
    "config_sides" "text" DEFAULT 'Single Side'::"text" NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "discount" numeric DEFAULT 0 NOT NULL,
    "platform_fee" numeric DEFAULT 0 NOT NULL,
    "grand_total" numeric DEFAULT 0 NOT NULL,
    "payment_method" "text" DEFAULT 'Pay On Counter'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "order_status" "text" DEFAULT 'Queued'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "target_pc_id" "text",
    "target_pc_name" "text",
    "file_url" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "page_range" "text" DEFAULT 'all'::"text",
    "shop_code" "text",
    "documents_config" "jsonb" DEFAULT '[]'::"jsonb",
    "payu_txnid" "text",
    "payu_payment_id" "text",
    "receipt_number" "text",
    "printed_segments" "jsonb" DEFAULT '[]'::"jsonb",
    "remaining_pages_info" "jsonb",
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "config_layout" "text" DEFAULT 'Portrait'::"text"
);


--
-- Name: print_shops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."print_shops" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner_name" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "address" "text" NOT NULL,
    "terminal_code" "text" NOT NULL,
    "latitude" numeric DEFAULT 18.5204,
    "longitude" numeric DEFAULT 73.8567,
    "rating" numeric DEFAULT 4.8,
    "total_reviews" integer DEFAULT 120,
    "is_open" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "qr_code_data" "text",
    "bank_account_no" "text",
    "bank_ifsc" "text",
    "upi_id" "text",
    "membership_enabled" boolean DEFAULT true,
    "membership_price" numeric DEFAULT 99.0,
    "membership_validity_days" integer DEFAULT 30,
    "services" "jsonb" DEFAULT '["Xerox", "Color Printing", "Spiral Binding", "Lamination", "Document Scanning", "Photo Glossy Print"]'::"jsonb",
    "logo_url" "text",
    "banner_url" "text",
    "city" "text" DEFAULT 'Pune'::"text",
    "shop_code" "text",
    "membership_discount_percent" integer DEFAULT 15,
    "payment_method_config" "text" DEFAULT 'both'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "pc_limit" integer DEFAULT 2,
    "operating_hours" "jsonb" DEFAULT '{"friday": "09:00 - 21:00", "monday": "09:00 - 21:00", "sunday": "Closed", "tuesday": "09:00 - 21:00", "saturday": "09:00 - 20:00", "thursday": "09:00 - 21:00", "wednesday": "09:00 - 21:00"}'::"jsonb",
    "closed_days" "jsonb" DEFAULT '["Sunday"]'::"jsonb",
    "equipment" "jsonb" DEFAULT '["Canon imageRUNNER ADVANCE", "HP LaserJet Enterprise", "Epson EcoTank L805"]'::"jsonb",
    "email" "text",
    "contact_phone" "text",
    "landmark" "text",
    "opening_hours" "text"
);


--
-- Name: security_passwords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."security_passwords" (
    "id" "text" NOT NULL,
    "password_type" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "is_configured" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


--
-- Name: shop_feedback; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."shop_feedback" AS
 SELECT "id",
    "user_id",
    "user_name",
    "rating",
    "category",
    "feedback_text",
    "feedback_text" AS "comment",
    "created_at",
    "shop_id",
    "target_type",
    "moderation_status",
    ("moderation_status" = 'approved'::"text") AS "is_accepted"
   FROM "public"."app_feedback";


--
-- Name: shop_pc_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_pc_requests" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "current_pc_limit" integer DEFAULT 2,
    "requested_pcs" integer DEFAULT 1,
    "reason" "text",
    "additional_charges" numeric DEFAULT 500,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: shop_pcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_pcs" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "pc_name" "text" NOT NULL,
    "pc_code" "text" NOT NULL,
    "is_default" boolean DEFAULT false,
    "status" "text" DEFAULT 'online'::"text",
    "ip_address" "text" DEFAULT '192.168.1.101'::"text",
    "qr_code_data" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_heartbeat" timestamp with time zone DEFAULT "now"(),
    "is_current_pc" boolean DEFAULT false,
    "os_info" "text" DEFAULT 'Windows 11 Pro 64-bit'::"text",
    "agent_version" "text" DEFAULT '1.2.0'::"text",
    "is_enabled" boolean DEFAULT true,
    "deleted_at" timestamp with time zone
);


--
-- Name: shop_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_pricing" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "color_single" numeric DEFAULT 5.0,
    "bw_single" numeric DEFAULT 2.0,
    "color_double" numeric DEFAULT 8.0,
    "bw_double" numeric DEFAULT 3.0,
    "a4_rate" numeric DEFAULT 0.0,
    "a3_rate" numeric DEFAULT 10.0,
    "bond_rate" numeric DEFAULT 5.0,
    "glossy_rate" numeric DEFAULT 15.0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "membership_enabled" boolean DEFAULT true,
    "membership_monthly_fee" numeric DEFAULT 99,
    "membership_discount_percent" integer DEFAULT 15,
    "membership_billing_cycle" "text" DEFAULT 'Monthly'::"text",
    "dynamic_paper_types" "jsonb" DEFAULT '[]'::"jsonb",
    "urgent_surcharge" numeric DEFAULT 5.0,
    "binding_rate" numeric DEFAULT 30.0,
    "lamination_rate" numeric DEFAULT 20.0,
    "bw_pricing_mode" "text" DEFAULT 'print'::"text" NOT NULL,
    "color_pricing_mode" "text" DEFAULT 'print'::"text" NOT NULL,
    "eligible_bw_single" boolean DEFAULT true NOT NULL,
    "eligible_bw_back_to_back" boolean DEFAULT true NOT NULL,
    "eligible_color_single" boolean DEFAULT true NOT NULL,
    "eligible_color_back_to_back" boolean DEFAULT true NOT NULL,
    "short_page_limit" integer DEFAULT 0 NOT NULL,
    "bw_short_page_rate" numeric DEFAULT 0 NOT NULL,
    "color_short_page_rate" numeric DEFAULT 0 NOT NULL
);


--
-- Name: shop_dynamic_paper_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_dynamic_paper_types" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "bw_price" numeric DEFAULT 0 NOT NULL,
    "color_price" numeric DEFAULT 0 NOT NULL,
    "is_special" boolean DEFAULT false NOT NULL,
    "eligible_bw_single" boolean DEFAULT true NOT NULL,
    "eligible_bw_back_to_back" boolean DEFAULT true NOT NULL,
    "eligible_color_single" boolean DEFAULT true NOT NULL,
    "eligible_color_back_to_back" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shop_dynamic_paper_types_bw_price_check" CHECK ("bw_price" >= 0),
    CONSTRAINT "shop_dynamic_paper_types_color_price_check" CHECK ("color_price" >= 0),
    CONSTRAINT "shop_dynamic_paper_types_pkey" PRIMARY KEY ("shop_id", "id")
);


--
-- Name: shop_printers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_printers" (
    "id" "text" DEFAULT ('prn_'::"text" || "substr"("md5"(("random"())::"text"), 1, 14)) NOT NULL,
    "shop_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "model" "text",
    "connection_type" "text" DEFAULT 'usb'::"text",
    "status" "text" DEFAULT 'online'::"text",
    "capabilities" "jsonb" DEFAULT '{"bw": true, "color": true, "double_side": true, "single_side": true}'::"jsonb",
    "paper_sizes" "jsonb" DEFAULT '["A4", "A3"]'::"jsonb",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pc_id" "text",
    "hardware_id" "text",
    "is_online" boolean DEFAULT true,
    "usage_type" "text" DEFAULT 'All'::"text",
    "is_color" boolean DEFAULT true,
    "is_duplex" boolean DEFAULT true,
    "paper_types" "jsonb" DEFAULT '["Standard 75 GSM", "Bond Paper", "Glossy"]'::"jsonb",
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: shop_qrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_qrs" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "pc_id" "text",
    "qr_name" "text" NOT NULL,
    "shop_code" "text" NOT NULL,
    "qr_data" "text" NOT NULL,
    "target_url" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "scan_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: shop_reminder_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_reminder_logs" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "threshold" integer NOT NULL,
    "print_count" integer NOT NULL,
    "action" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reminder_id" "text",
    "printer_name" "text",
    "counter_type" "text" DEFAULT 'all'::"text",
    "prints_done" integer DEFAULT 0,
    "reset_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: shop_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_reminders" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "page_threshold" integer DEFAULT 2000,
    "current_print_count" integer DEFAULT 0,
    "last_reminded_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "last_status" "text" DEFAULT 'idle'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" DEFAULT 'Toner Cartridge & Paper Restock Alert'::"text",
    "printer_id" "text",
    "purpose" "text" DEFAULT 'Toner Yield Alert'::"text",
    "page_count_limit" integer DEFAULT 2000,
    "warning_threshold" integer DEFAULT 200,
    "cycle_history" "jsonb" DEFAULT '[]'::"jsonb",
    "printer_name" "text",
    "print_mode" "text" DEFAULT 'both'::"text",
    "bw_limit" integer DEFAULT 1000,
    "color_limit" integer DEFAULT 500,
    "bw_printed_count" integer DEFAULT 0,
    "color_printed_count" integer DEFAULT 0,
    "bw_threshold" integer DEFAULT 50,
    "color_threshold" integer DEFAULT 50,
    "cartridge_notes" "text",
    "is_archived" boolean DEFAULT false
);


--
-- Name: shop_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_settlements" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "total_orders" integer DEFAULT 0,
    "gross_amount" numeric DEFAULT 0,
    "platform_commission" numeric DEFAULT 0,
    "net_payable" numeric DEFAULT 0,
    "settlement_cycle" "text" DEFAULT '2-day cycle'::"text",
    "cycle_start_date" timestamp with time zone DEFAULT ("now"() - '2 days'::interval),
    "cycle_end_date" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text",
    "bank_account_no" "text",
    "bank_ifsc" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "rejection_reason" "text",
    "payout_reference" "text",
    "payment_mode" "text"
);


--
-- Name: shop_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shop_subscriptions" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "plan_id" "text" DEFAULT 'pro'::"text" NOT NULL,
    "plan_name" "text" DEFAULT 'Pro Shop Plan'::"text" NOT NULL,
    "price" numeric DEFAULT 499.0,
    "pc_limit" integer DEFAULT 3,
    "validity_days" integer DEFAULT 30,
    "start_date" timestamp with time zone DEFAULT "now"(),
    "expiry_date" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "status" "text" DEFAULT 'active'::"text",
    "auto_renew" boolean DEFAULT true,
    "payment_id" "text",
    "order_id" "text",
    "payment_status" "text" DEFAULT 'completed'::"text"
);


--
-- Name: shopkeeper_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shopkeeper_accounts" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "owner_name" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'shopkeeper'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "is_active" boolean DEFAULT true,
    "disabled_reason" "text",
    "disabled_at" timestamp with time zone
);


--
-- Name: shopkeeper_enquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shopkeeper_enquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "mobile_number" "text" NOT NULL,
    "email" "text" NOT NULL,
    "pan_card_number" "text" NOT NULL,
    "pan_verified" boolean DEFAULT false,
    "pan_holder_name" "text",
    "pan_verification_status" "text" DEFAULT 'Unverified'::"text",
    "address" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "business_address" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "pin_code" "text" NOT NULL,
    "business_contact_number" "text",
    "business_email" "text",
    "business_type" "text",
    "gst_number" "text",
    "selected_package_id" "text",
    "selected_package_name" "text",
    "enquiry_status" "text" DEFAULT 'New'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: shopkeeper_password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shopkeeper_password_resets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_used" boolean DEFAULT false NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


--
-- Name: shopkeeper_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."shopkeeper_settings" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "theme_mode" "text" DEFAULT 'dark'::"text",
    "color_theme" "text" DEFAULT 'orange'::"text",
    "language" "text" DEFAULT 'en'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reports_password" "text",
    "printers_password" "text",
    "current_otp" "text",
    "otp_expires_at" timestamp with time zone,
    "specialized_paper_colors" "jsonb" DEFAULT '{}'::"jsonb",
    "dynamic_paper_types" "jsonb" DEFAULT '[]'::"jsonb",
    "qz_permission_choice" "text",
    "pinned_order_ids" "text"[] DEFAULT '{}'::"text"[]
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "price" numeric NOT NULL,
    "duration_days" integer DEFAULT 30,
    "pc_limit" integer DEFAULT 2,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "services" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "is_popular" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: super_admin_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."super_admin_profiles" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'super_admin'::"text",
    "avatar_url" "text",
    "preferred_theme" "text" DEFAULT 'white_red'::"text",
    "theme_mode" "text" DEFAULT 'light'::"text",
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "admin_response" "text",
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "messages" "jsonb" DEFAULT '[]'::"jsonb",
    "owner_name" "text",
    "owner_contact" "text"
);


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."trusted_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shopkeeper_id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "device_info" "text",
    "ip_address" "text",
    "user_agent" "text",
    "last_used_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


--
-- Name: upload_page_ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."upload_page_ads" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text" NOT NULL,
    "destination_url" "text" NOT NULL,
    "display_order" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: user_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "guest_id" "text",
    "consent_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "policy_version" "text" DEFAULT '1.0'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" "text",
    "owner_id" "text",
    "accepted" boolean DEFAULT true
);


--
-- Name: user_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_memberships" (
    "id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "tier" "text" DEFAULT 'Print Club VIP'::"text" NOT NULL,
    "card_number" "text" NOT NULL,
    "discount_percentage" integer DEFAULT 20,
    "is_active" boolean DEFAULT true,
    "valid_until" "text" DEFAULT '2027-12-31'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" "text" DEFAULT 'ent-02'::"text",
    "user_name" "text" DEFAULT 'Student Customer'::"text",
    "user_phone" "text" DEFAULT '+91 98765 43210'::"text",
    "user_email" "text" DEFAULT 'student@campus.edu'::"text",
    "fee_paid" numeric DEFAULT 199,
    "billing_cycle" "text" DEFAULT 'Monthly'::"text"
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "default_sides" "text" DEFAULT 'single'::"text",
    "default_print_type" "text" DEFAULT 'bw'::"text",
    "default_page_size" "text" DEFAULT 'A4'::"text",
    "default_copies" integer DEFAULT 1,
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_print_size" "text" DEFAULT 'A4'::"text",
    "default_paper_quality" "text" DEFAULT 'Standard (75 GSM)'::"text"
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "surname" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text" DEFAULT ''::"text",
    "is_verified" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "password_hash" "text"
);


--
-- Name: ad_requests ad_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ad_requests_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ad_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ad_requests"
    ADD CONSTRAINT "ad_requests_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: admin_otps admin_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'admin_otps_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'admin_otps'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."admin_otps"
    ADD CONSTRAINT "admin_otps_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_feedback app_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'app_feedback_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'app_feedback'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."app_feedback"
    ADD CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: career_applications career_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'career_applications_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'career_applications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."career_applications"
    ADD CONSTRAINT "career_applications_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: careers careers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'careers_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'careers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."careers"
    ADD CONSTRAINT "careers_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cms_content cms_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'cms_content_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'cms_content'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."cms_content"
    ADD CONSTRAINT "cms_content_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'contact_messages_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'contact_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners home_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'home_banners_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: informational_pages informational_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'informational_pages_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'informational_pages'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."informational_pages"
    ADD CONSTRAINT "informational_pages_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: informational_pages informational_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'informational_pages_slug_key'
      AND n.nspname = 'public'
      AND c.relname = 'informational_pages'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."informational_pages"
    ADD CONSTRAINT "informational_pages_slug_key" UNIQUE ("slug");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'payments_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'payments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: platform_policies platform_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'platform_policies_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'platform_policies'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."platform_policies"
    ADD CONSTRAINT "platform_policies_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'platform_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'platform_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: platform_terms platform_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'platform_terms_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'platform_terms'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."platform_terms"
    ADD CONSTRAINT "platform_terms_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_jobs print_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'print_jobs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'print_jobs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_orders print_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'print_orders_order_number_key'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."print_orders"
    ADD CONSTRAINT "print_orders_order_number_key" UNIQUE ("order_number");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_orders print_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'print_orders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."print_orders"
    ADD CONSTRAINT "print_orders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops print_shops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'print_shops_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."print_shops"
    ADD CONSTRAINT "print_shops_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops print_shops_terminal_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'print_shops_terminal_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."print_shops"
    ADD CONSTRAINT "print_shops_terminal_code_key" UNIQUE ("terminal_code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: security_passwords security_passwords_password_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'security_passwords_password_type_key'
      AND n.nspname = 'public'
      AND c.relname = 'security_passwords'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."security_passwords"
    ADD CONSTRAINT "security_passwords_password_type_key" UNIQUE ("password_type");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: security_passwords security_passwords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'security_passwords_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'security_passwords'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."security_passwords"
    ADD CONSTRAINT "security_passwords_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pc_requests shop_pc_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_pc_requests_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pc_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_pc_requests"
    ADD CONSTRAINT "shop_pc_requests_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pcs shop_pcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_pcs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pcs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_pcs"
    ADD CONSTRAINT "shop_pcs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pricing shop_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_pricing_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pricing'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_pricing"
    ADD CONSTRAINT "shop_pricing_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pricing shop_pricing_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_pricing_shop_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pricing'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_pricing"
    ADD CONSTRAINT "shop_pricing_shop_id_key" UNIQUE ("shop_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_printers shop_printers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_printers_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_printers'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_printers"
    ADD CONSTRAINT "shop_printers_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_qrs shop_qrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_qrs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_qrs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_qrs"
    ADD CONSTRAINT "shop_qrs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_qrs shop_qrs_shop_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_qrs_shop_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'shop_qrs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_qrs"
    ADD CONSTRAINT "shop_qrs_shop_code_key" UNIQUE ("shop_code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_reminder_logs shop_reminder_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_reminder_logs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_reminder_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_reminder_logs"
    ADD CONSTRAINT "shop_reminder_logs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_reminders shop_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_reminders_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_reminders"
    ADD CONSTRAINT "shop_reminders_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_settlements shop_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_settlements_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_settlements'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_settlements"
    ADD CONSTRAINT "shop_settlements_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_subscriptions shop_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_subscriptions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shop_subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_subscriptions"
    ADD CONSTRAINT "shop_subscriptions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_subscriptions shop_subscriptions_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shop_subscriptions_shop_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'shop_subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shop_subscriptions"
    ADD CONSTRAINT "shop_subscriptions_shop_id_key" UNIQUE ("shop_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_accounts shopkeeper_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_accounts_email_key'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_accounts'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_accounts"
    ADD CONSTRAINT "shopkeeper_accounts_email_key" UNIQUE ("email");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_accounts shopkeeper_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_accounts_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_accounts'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_accounts"
    ADD CONSTRAINT "shopkeeper_accounts_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_enquiries shopkeeper_enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_enquiries_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_enquiries'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_enquiries"
    ADD CONSTRAINT "shopkeeper_enquiries_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_password_resets shopkeeper_password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_password_resets_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_password_resets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_password_resets"
    ADD CONSTRAINT "shopkeeper_password_resets_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_password_resets shopkeeper_password_resets_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_password_resets_token_hash_key'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_password_resets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_password_resets"
    ADD CONSTRAINT "shopkeeper_password_resets_token_hash_key" UNIQUE ("token_hash");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_settings shopkeeper_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_settings"
    ADD CONSTRAINT "shopkeeper_settings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_settings shopkeeper_settings_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'shopkeeper_settings_shop_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."shopkeeper_settings"
    ADD CONSTRAINT "shopkeeper_settings_shop_id_key" UNIQUE ("shop_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscription_plans subscription_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'subscription_plans_code_key'
      AND n.nspname = 'public'
      AND c.relname = 'subscription_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_code_key" UNIQUE ("code");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'subscription_plans_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'subscription_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: super_admin_profiles super_admin_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'super_admin_profiles_email_key'
      AND n.nspname = 'public'
      AND c.relname = 'super_admin_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."super_admin_profiles"
    ADD CONSTRAINT "super_admin_profiles_email_key" UNIQUE ("email");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: super_admin_profiles super_admin_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'super_admin_profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'super_admin_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."super_admin_profiles"
    ADD CONSTRAINT "super_admin_profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'support_tickets_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'support_tickets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'trusted_devices_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'trusted_devices'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."trusted_devices"
    ADD CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: trusted_devices trusted_devices_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'trusted_devices_token_hash_key'
      AND n.nspname = 'public'
      AND c.relname = 'trusted_devices'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."trusted_devices"
    ADD CONSTRAINT "trusted_devices_token_hash_key" UNIQUE ("token_hash");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: upload_page_ads upload_page_ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'upload_page_ads_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'upload_page_ads'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."upload_page_ads"
    ADD CONSTRAINT "upload_page_ads_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents uploaded_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'uploaded_documents_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_consents user_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_consents_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_consents'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_memberships user_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_memberships_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_memberships'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_memberships"
    ADD CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_preferences_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_preferences'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_preferences_user_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'user_preferences'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: idx_password_resets_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_password_resets_email" ON "public"."shopkeeper_password_resets" USING "btree" ("email");


--
-- Name: idx_password_resets_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_password_resets_token" ON "public"."shopkeeper_password_resets" USING "btree" ("token_hash");


--
-- Name: idx_print_orders_shop_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_print_orders_shop_created" ON "public"."print_orders" USING "btree" ("shop_id", "created_at" DESC);


--
-- Name: idx_print_orders_shop_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_print_orders_shop_order_status" ON "public"."print_orders" USING "btree" ("shop_id", "order_status");


--
-- Name: idx_print_orders_shop_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_print_orders_shop_status_created" ON "public"."print_orders" USING "btree" ("shop_id", "order_status", "created_at" DESC);


--
-- Name: idx_print_shops_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_print_shops_city" ON "public"."print_shops" USING "btree" ("city");


--
-- Name: idx_print_shops_shop_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_print_shops_shop_code" ON "public"."print_shops" USING "btree" ("shop_code");


--
-- Name: idx_print_shops_terminal_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_print_shops_terminal_code" ON "public"."print_shops" USING "btree" ("terminal_code");


--
-- Name: idx_shop_printers_pc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shop_printers_pc_id" ON "public"."shop_printers" USING "btree" ("pc_id");


--
-- Name: idx_shop_printers_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shop_printers_shop_id" ON "public"."shop_printers" USING "btree" ("shop_id");


--
-- Name: shop_dynamic_paper_types_shop_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS "shop_dynamic_paper_types_shop_name_key"
    ON "public"."shop_dynamic_paper_types" USING "btree" ("shop_id", "lower"("name"));

--
-- Name: shop_dynamic_paper_types_shop_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "shop_dynamic_paper_types_shop_active_idx"
    ON "public"."shop_dynamic_paper_types" USING "btree" ("shop_id", "is_active");


--
-- Name: idx_shop_qrs_shop_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shop_qrs_shop_code" ON "public"."shop_qrs" USING "btree" ("shop_code");


--
-- Name: idx_shop_qrs_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shop_qrs_shop_id" ON "public"."shop_qrs" USING "btree" ("shop_id");


--
-- Name: idx_shopkeeper_accounts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shopkeeper_accounts_email" ON "public"."shopkeeper_accounts" USING "btree" ("email");


--
-- Name: idx_shopkeeper_accounts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shopkeeper_accounts_is_active" ON "public"."shopkeeper_accounts" USING "btree" ("is_active");


--
-- Name: idx_shopkeeper_accounts_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shopkeeper_accounts_shop_id" ON "public"."shopkeeper_accounts" USING "btree" ("shop_id");


--
-- Name: idx_shopkeeper_accounts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_shopkeeper_accounts_status" ON "public"."shopkeeper_accounts" USING "btree" ("status");


--
-- Name: idx_trusted_devices_shopkeeper; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_trusted_devices_shopkeeper" ON "public"."trusted_devices" USING "btree" ("shopkeeper_id");


--
-- Name: idx_trusted_devices_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_trusted_devices_token" ON "public"."trusted_devices" USING "btree" ("token_hash");


--
-- Name: idx_uploaded_documents_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_uploaded_documents_order_id" ON "public"."uploaded_documents" USING "btree" ("order_id");


--
-- Name: payments_payu_txnid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS "payments_payu_txnid_unique" ON "public"."payments" USING "btree" ("payu_txnid") WHERE ("payu_txnid" IS NOT NULL);


--
-- Name: print_jobs print_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'print_jobs_order_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'print_jobs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."print_orders"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Admins can manage home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can manage home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can manage home_banners" ON "public"."home_banners" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: upload_page_ads Admins can manage upload_page_ads; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can manage upload_page_ads'
      AND n.nspname = 'public'
      AND c.relname = 'upload_page_ads'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can manage upload_page_ads" ON "public"."upload_page_ads" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cms_content Allow all access on cms_content; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all access on cms_content'
      AND n.nspname = 'public'
      AND c.relname = 'cms_content'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all access on cms_content" ON "public"."cms_content" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pc_requests Allow all access on shop_pc_requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all access on shop_pc_requests'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pc_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all access on shop_pc_requests" ON "public"."shop_pc_requests" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: subscription_plans Allow all access on subscription_plans; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all access on subscription_plans'
      AND n.nspname = 'public'
      AND c.relname = 'subscription_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all access on subscription_plans" ON "public"."subscription_plans" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: super_admin_profiles Allow all access on super_admin_profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all access on super_admin_profiles'
      AND n.nspname = 'public'
      AND c.relname = 'super_admin_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all access on super_admin_profiles" ON "public"."super_admin_profiles" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ad_requests Allow all on ad_requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on ad_requests'
      AND n.nspname = 'public'
      AND c.relname = 'ad_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on ad_requests" ON "public"."ad_requests" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_feedback Allow all on app_feedback; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on app_feedback'
      AND n.nspname = 'public'
      AND c.relname = 'app_feedback'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on app_feedback" ON "public"."app_feedback" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: career_applications Allow all on career_applications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on career_applications'
      AND n.nspname = 'public'
      AND c.relname = 'career_applications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on career_applications" ON "public"."career_applications" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: careers Allow all on careers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on careers'
      AND n.nspname = 'public'
      AND c.relname = 'careers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on careers" ON "public"."careers" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: contact_messages Allow all on contact_messages; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on contact_messages'
      AND n.nspname = 'public'
      AND c.relname = 'contact_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on contact_messages" ON "public"."contact_messages" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Allow all on home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on home_banners" ON "public"."home_banners" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Allow all on notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on notifications" ON "public"."notifications" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: payments Allow all on payments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on payments'
      AND n.nspname = 'public'
      AND c.relname = 'payments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on payments" ON "public"."payments" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_orders Allow all on print_orders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on print_orders'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on print_orders" ON "public"."print_orders" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops Allow all on print_shops; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on print_shops'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on print_shops" ON "public"."print_shops" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_qrs Allow all on shop_qrs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on shop_qrs'
      AND n.nspname = 'public'
      AND c.relname = 'shop_qrs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on shop_qrs" ON "public"."shop_qrs" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_settlements Allow all on shop_settlements; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on shop_settlements'
      AND n.nspname = 'public'
      AND c.relname = 'shop_settlements'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on shop_settlements" ON "public"."shop_settlements" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_accounts Allow all on shopkeeper_accounts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on shopkeeper_accounts'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_accounts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on shopkeeper_accounts" ON "public"."shopkeeper_accounts" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: support_tickets Allow all on support_tickets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on support_tickets'
      AND n.nspname = 'public'
      AND c.relname = 'support_tickets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on support_tickets" ON "public"."support_tickets" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: upload_page_ads Allow all on upload_page_ads; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on upload_page_ads'
      AND n.nspname = 'public'
      AND c.relname = 'upload_page_ads'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on upload_page_ads" ON "public"."upload_page_ads" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents Allow all on uploaded_documents; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on uploaded_documents'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on uploaded_documents" ON "public"."uploaded_documents" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_memberships Allow all on user_memberships; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on user_memberships'
      AND n.nspname = 'public'
      AND c.relname = 'user_memberships'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on user_memberships" ON "public"."user_memberships" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_preferences Allow all on user_preferences; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on user_preferences'
      AND n.nspname = 'public'
      AND c.relname = 'user_preferences'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on user_preferences" ON "public"."user_preferences" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_profiles Allow all on user_profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow all on user_profiles'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow all on user_profiles" ON "public"."user_profiles" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Allow authenticated delete on home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated delete on home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated delete on home_banners" ON "public"."home_banners" FOR DELETE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Allow authenticated insert on home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated insert on home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated insert on home_banners" ON "public"."home_banners" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_enquiries Allow authenticated to update shopkeeper enquiries; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated to update shopkeeper enquiries'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_enquiries'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated to update shopkeeper enquiries" ON "public"."shopkeeper_enquiries" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Allow authenticated update on home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated update on home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow authenticated update on home_banners" ON "public"."home_banners" FOR UPDATE TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: admin_otps Allow full access to admin_otps; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow full access to admin_otps'
      AND n.nspname = 'public'
      AND c.relname = 'admin_otps'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow full access to admin_otps" ON "public"."admin_otps" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: informational_pages Allow full access to informational_pages; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow full access to informational_pages'
      AND n.nspname = 'public'
      AND c.relname = 'informational_pages'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow full access to informational_pages" ON "public"."informational_pages" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: security_passwords Allow full access to security_passwords; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow full access to security_passwords'
      AND n.nspname = 'public'
      AND c.relname = 'security_passwords'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow full access to security_passwords" ON "public"."security_passwords" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_enquiries Allow public anon to insert shopkeeper enquiries; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public anon to insert shopkeeper enquiries'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_enquiries'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public anon to insert shopkeeper enquiries" ON "public"."shopkeeper_enquiries" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_enquiries Allow public anon to select shopkeeper enquiries; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public anon to select shopkeeper enquiries'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_enquiries'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public anon to select shopkeeper enquiries" ON "public"."shopkeeper_enquiries" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_jobs Allow public delete on print_jobs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public delete on print_jobs'
      AND n.nspname = 'public'
      AND c.relname = 'print_jobs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public delete on print_jobs" ON "public"."print_jobs" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_jobs Allow public insert on print_jobs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public insert on print_jobs'
      AND n.nspname = 'public'
      AND c.relname = 'print_jobs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public insert on print_jobs" ON "public"."print_jobs" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Allow public read access on home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public read access on home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public read access on home_banners" ON "public"."home_banners" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_jobs Allow public select on print_jobs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public select on print_jobs'
      AND n.nspname = 'public'
      AND c.relname = 'print_jobs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public select on print_jobs" ON "public"."print_jobs" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_jobs Allow public update on print_jobs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public update on print_jobs'
      AND n.nspname = 'public'
      AND c.relname = 'print_jobs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow public update on print_jobs" ON "public"."print_jobs" FOR UPDATE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: careers Allow select active careers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow select active careers'
      AND n.nspname = 'public'
      AND c.relname = 'careers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Allow select active careers" ON "public"."careers" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents Anyone can insert uploaded_documents; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can insert uploaded_documents'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can insert uploaded_documents" ON "public"."uploaded_documents" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents Anyone can select uploaded_documents; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can select uploaded_documents'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can select uploaded_documents" ON "public"."uploaded_documents" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents Anyone can update uploaded_documents; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can update uploaded_documents'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can update uploaded_documents" ON "public"."uploaded_documents" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_consents Public can insert user_consents; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can insert user_consents'
      AND n.nspname = 'public'
      AND c.relname = 'user_consents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can insert user_consents" ON "public"."user_consents" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: home_banners Public can view active home_banners; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view active home_banners'
      AND n.nspname = 'public'
      AND c.relname = 'home_banners'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view active home_banners" ON "public"."home_banners" FOR SELECT USING (("is_active" = true));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: upload_page_ads Public can view active upload_page_ads; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view active upload_page_ads'
      AND n.nspname = 'public'
      AND c.relname = 'upload_page_ads'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public can view active upload_page_ads" ON "public"."upload_page_ads" FOR SELECT USING (("is_active" = true));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_consents Users can view own consents; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own consents'
      AND n.nspname = 'public'
      AND c.relname = 'user_consents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own consents" ON "public"."user_consents" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ad_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ad_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_requests ad_requests_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'ad_requests_delete'
      AND n.nspname = 'public'
      AND c.relname = 'ad_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "ad_requests_delete" ON "public"."ad_requests" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ad_requests ad_requests_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'ad_requests_insert'
      AND n.nspname = 'public'
      AND c.relname = 'ad_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "ad_requests_insert" ON "public"."ad_requests" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ad_requests ad_requests_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'ad_requests_select'
      AND n.nspname = 'public'
      AND c.relname = 'ad_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "ad_requests_select" ON "public"."ad_requests" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ad_requests ad_requests_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'ad_requests_update'
      AND n.nspname = 'public'
      AND c.relname = 'ad_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "ad_requests_update" ON "public"."ad_requests" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: admin_otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_otps" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_policies allow_all_platform_policies; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_platform_policies'
      AND n.nspname = 'public'
      AND c.relname = 'platform_policies'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_platform_policies" ON "public"."platform_policies" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: platform_terms allow_all_platform_terms; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_platform_terms'
      AND n.nspname = 'public'
      AND c.relname = 'platform_terms'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_platform_terms" ON "public"."platform_terms" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pcs allow_all_shop_pcs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_pcs'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pcs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_pcs" ON "public"."shop_pcs" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_pricing allow_all_shop_pricing; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_pricing'
      AND n.nspname = 'public'
      AND c.relname = 'shop_pricing'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_pricing" ON "public"."shop_pricing" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_dynamic_paper_types allow_all_shop_dynamic_paper_types; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_dynamic_paper_types'
      AND n.nspname = 'public'
      AND c.relname = 'shop_dynamic_paper_types'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_dynamic_paper_types" ON "public"."shop_dynamic_paper_types" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_printers allow_all_shop_printers; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_printers'
      AND n.nspname = 'public'
      AND c.relname = 'shop_printers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_printers" ON "public"."shop_printers" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_qrs allow_all_shop_qrs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_qrs'
      AND n.nspname = 'public'
      AND c.relname = 'shop_qrs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_qrs" ON "public"."shop_qrs" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_reminder_logs allow_all_shop_reminder_logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_reminder_logs'
      AND n.nspname = 'public'
      AND c.relname = 'shop_reminder_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_reminder_logs" ON "public"."shop_reminder_logs" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_reminders allow_all_shop_reminders; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_reminders'
      AND n.nspname = 'public'
      AND c.relname = 'shop_reminders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_reminders" ON "public"."shop_reminders" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shop_subscriptions allow_all_shop_subscriptions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shop_subscriptions'
      AND n.nspname = 'public'
      AND c.relname = 'shop_subscriptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shop_subscriptions" ON "public"."shop_subscriptions" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_accounts allow_all_shopkeeper_accounts; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shopkeeper_accounts'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_accounts'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shopkeeper_accounts" ON "public"."shopkeeper_accounts" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: shopkeeper_settings allow_all_shopkeeper_settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_shopkeeper_settings'
      AND n.nspname = 'public'
      AND c.relname = 'shopkeeper_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_shopkeeper_settings" ON "public"."shopkeeper_settings" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: support_tickets allow_all_support_tickets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'allow_all_support_tickets'
      AND n.nspname = 'public'
      AND c.relname = 'support_tickets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "allow_all_support_tickets" ON "public"."support_tickets" TO "authenticated", "anon" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_feedback" ENABLE ROW LEVEL SECURITY;

--
-- Name: app_feedback app_feedback_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'app_feedback_delete'
      AND n.nspname = 'public'
      AND c.relname = 'app_feedback'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "app_feedback_delete" ON "public"."app_feedback" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_feedback app_feedback_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'app_feedback_insert'
      AND n.nspname = 'public'
      AND c.relname = 'app_feedback'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "app_feedback_insert" ON "public"."app_feedback" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_feedback app_feedback_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'app_feedback_select'
      AND n.nspname = 'public'
      AND c.relname = 'app_feedback'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "app_feedback_select" ON "public"."app_feedback" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: app_feedback app_feedback_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'app_feedback_update'
      AND n.nspname = 'public'
      AND c.relname = 'app_feedback'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "app_feedback_update" ON "public"."app_feedback" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: career_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."career_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: careers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."careers" ENABLE ROW LEVEL SECURITY;

--
-- Name: cms_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."cms_content" ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: home_banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."home_banners" ENABLE ROW LEVEL SECURITY;

--
-- Name: informational_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."informational_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."platform_policies" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."platform_terms" ENABLE ROW LEVEL SECURITY;

--
-- Name: print_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."print_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: print_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."print_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: print_orders print_orders_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_orders_delete'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_orders_delete" ON "public"."print_orders" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_orders print_orders_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_orders_insert'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_orders_insert" ON "public"."print_orders" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_orders print_orders_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_orders_select'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_orders_select" ON "public"."print_orders" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_orders print_orders_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_orders_update'
      AND n.nspname = 'public'
      AND c.relname = 'print_orders'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_orders_update" ON "public"."print_orders" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."print_shops" ENABLE ROW LEVEL SECURITY;

--
-- Name: print_shops print_shops_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_shops_delete'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_shops_delete" ON "public"."print_shops" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops print_shops_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_shops_insert'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_shops_insert" ON "public"."print_shops" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops print_shops_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_shops_select'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_shops_select" ON "public"."print_shops" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: print_shops print_shops_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'print_shops_update'
      AND n.nspname = 'public'
      AND c.relname = 'print_shops'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "print_shops_update" ON "public"."print_shops" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: security_passwords; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."security_passwords" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_pc_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_pc_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_pcs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_pcs" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_pricing" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_dynamic_paper_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_dynamic_paper_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_printers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_printers" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_qrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_qrs" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_reminder_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_reminder_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_reminders" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_settlements" ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shop_subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: shopkeeper_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shopkeeper_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: shopkeeper_enquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shopkeeper_enquiries" ENABLE ROW LEVEL SECURITY;

--
-- Name: shopkeeper_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."shopkeeper_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: super_admin_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."super_admin_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;

--
-- Name: upload_page_ads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."upload_page_ads" ENABLE ROW LEVEL SECURITY;

--
-- Name: uploaded_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."uploaded_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: uploaded_documents uploaded_documents_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'uploaded_documents_delete'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "uploaded_documents_delete" ON "public"."uploaded_documents" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents uploaded_documents_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'uploaded_documents_insert'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "uploaded_documents_insert" ON "public"."uploaded_documents" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents uploaded_documents_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'uploaded_documents_select'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "uploaded_documents_select" ON "public"."uploaded_documents" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: uploaded_documents uploaded_documents_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'uploaded_documents_update'
      AND n.nspname = 'public'
      AND c.relname = 'uploaded_documents'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "uploaded_documents_update" ON "public"."uploaded_documents" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_memberships" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_memberships user_memberships_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_memberships_delete'
      AND n.nspname = 'public'
      AND c.relname = 'user_memberships'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_memberships_delete" ON "public"."user_memberships" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_memberships user_memberships_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_memberships_insert'
      AND n.nspname = 'public'
      AND c.relname = 'user_memberships'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_memberships_insert" ON "public"."user_memberships" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_memberships user_memberships_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_memberships_select'
      AND n.nspname = 'public'
      AND c.relname = 'user_memberships'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_memberships_select" ON "public"."user_memberships" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_memberships user_memberships_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_memberships_update'
      AND n.nspname = 'public'
      AND c.relname = 'user_memberships'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_memberships_update" ON "public"."user_memberships" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles user_profiles_delete; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_profiles_delete'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_profiles_delete" ON "public"."user_profiles" FOR DELETE USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_profiles user_profiles_insert; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_profiles_insert'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_profiles_insert" ON "public"."user_profiles" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_profiles user_profiles_select; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_profiles_select'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_profiles_select" ON "public"."user_profiles" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_profiles user_profiles_update; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'user_profiles_update'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "user_profiles_update" ON "public"."user_profiles" FOR UPDATE USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- policy: "Anyone can read print_documents" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can read print_documents'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can read print_documents" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''print_documents''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Anyone can upload print_documents" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can upload print_documents'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can upload print_documents" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((bucket_id = ''print_documents''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public access to copygo_files" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public access to copygo_files'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public access to copygo_files" ON storage.objects AS PERMISSIVE FOR ALL TO PUBLIC USING ((bucket_id = ''copygo_files''::text)) WITH CHECK ((bucket_id = ''copygo_files''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Service and users can delete print_documents" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Service and users can delete print_documents'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Service and users can delete print_documents" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC USING ((bucket_id = ''print_documents''::text));';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.print_jobs
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.print_jobs')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.print_orders
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.print_orders')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.print_orders;';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.shop_pcs
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.shop_pcs')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_pcs;';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.shop_printers
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.shop_printers')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_printers;';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.shop_qrs
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.shop_qrs')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_qrs;';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('copygo_files', 'copygo_files', NULL, '2026-10-01 13:02:19.509248+00', '2026-10-01 13:02:19.509248+00', 'true', 'false', '52428800', '{application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('print_documents', 'print_documents', NULL, '2026-10-04 19:38:06.073825+00', '2026-10-04 19:38:06.073825+00', 'true', 'false', '52428800', '{application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain}', NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";

-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。
