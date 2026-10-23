CREATE TABLE IF NOT EXISTS public.shop_dynamic_paper_types (
  id text NOT NULL,
  shop_id text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  bw_price numeric NOT NULL DEFAULT 0 CHECK (bw_price >= 0),
  color_price numeric NOT NULL DEFAULT 0 CHECK (color_price >= 0),
  is_special boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_dynamic_paper_types_shop_name_key
  ON public.shop_dynamic_paper_types (shop_id, lower(name));

CREATE INDEX IF NOT EXISTS shop_dynamic_paper_types_shop_active_idx
  ON public.shop_dynamic_paper_types (shop_id, is_active);

ALTER TABLE public.shop_dynamic_paper_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_shop_dynamic_paper_types ON public.shop_dynamic_paper_types;
CREATE POLICY allow_all_shop_dynamic_paper_types
  ON public.shop_dynamic_paper_types
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_dynamic_paper_types TO anon, authenticated;

WITH legacy_types AS (
  SELECT
    settings.shop_id,
    item.value AS paper,
    1 AS source_priority
  FROM public.shopkeeper_settings AS settings
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(settings.dynamic_paper_types) = 'array'
        THEN settings.dynamic_paper_types
      ELSE '[]'::jsonb
    END
  ) AS item(value)

  UNION ALL

  SELECT
    pricing.shop_id,
    item.value AS paper,
    2 AS source_priority
  FROM public.shop_pricing AS pricing
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(pricing.dynamic_paper_types) = 'array'
        THEN pricing.dynamic_paper_types
      ELSE '[]'::jsonb
    END
  ) AS item(value)
),
normalized_types AS (
  SELECT DISTINCT ON (shop_id, lower(trim(paper->>'name')))
    shop_id,
    COALESCE(
      NULLIF(paper->>'id', ''),
      'pt_' || md5(shop_id || ':' || lower(trim(paper->>'name')))
    ) AS id,
    trim(paper->>'name') AS name,
    CASE
      WHEN lower(paper->>'is_active') IN ('true', 'false')
        THEN (paper->>'is_active')::boolean
      ELSE true
    END AS is_active,
    CASE
      WHEN paper->>'bw_price' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (paper->>'bw_price')::numeric
      ELSE 0
    END AS bw_price,
    CASE
      WHEN paper->>'color_price' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (paper->>'color_price')::numeric
      ELSE 0
    END AS color_price,
    CASE
      WHEN lower(paper->>'is_special') IN ('true', 'false')
        THEN (paper->>'is_special')::boolean
      ELSE false
    END AS is_special
  FROM legacy_types
  WHERE NULLIF(trim(paper->>'name'), '') IS NOT NULL
  ORDER BY shop_id, lower(trim(paper->>'name')), source_priority
)
INSERT INTO public.shop_dynamic_paper_types (
  id,
  shop_id,
  name,
  is_active,
  bw_price,
  color_price,
  is_special
)
SELECT
  id,
  shop_id,
  name,
  is_active,
  bw_price,
  color_price,
  is_special
FROM normalized_types
ON CONFLICT DO NOTHING;
