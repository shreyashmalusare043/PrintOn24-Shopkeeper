CREATE TABLE IF NOT EXISTS public.shopkeeper_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    email TEXT NOT NULL,
    pan_card_number TEXT NOT NULL,
    pan_verified BOOLEAN DEFAULT FALSE,
    pan_holder_name TEXT,
    pan_verification_status TEXT DEFAULT 'Unverified',
    address TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    business_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    business_contact_number TEXT,
    business_email TEXT,
    business_type TEXT,
    gst_number TEXT,
    selected_package_id TEXT,
    selected_package_name TEXT,
    enquiry_status TEXT DEFAULT 'New',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shopkeeper_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public anon to insert shopkeeper enquiries"
ON public.shopkeeper_enquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public anon to select shopkeeper enquiries"
ON public.shopkeeper_enquiries
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow authenticated to update shopkeeper enquiries"
ON public.shopkeeper_enquiries
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);