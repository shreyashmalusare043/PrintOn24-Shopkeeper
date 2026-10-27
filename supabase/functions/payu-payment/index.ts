declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(name: string): string | undefined };
};

const encoder = new TextEncoder();

function configuredOrigins(): Set<string> {
  const entries = [
    Deno.env.get('PAYU_APP_URL') || '',
    Deno.env.get('PAYU_ALLOWED_ORIGINS') || '',
  ]
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
  const origins = new Set<string>();

  for (const entry of entries) {
    try {
      const url = new URL(entry);
      if (
        (url.protocol === 'https:' || url.hostname === 'localhost') &&
        url.origin === entry.replace(/\/+$/, '')
      ) {
        origins.add(url.origin);
      }
    } catch {
      continue;
    }
  }

  return origins;
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  const allowedOrigin = origin && configuredOrigins().has(origin) ? origin : '';

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function supabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseRequest<T>(
  path: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(serviceRoleKey), ...init.headers },
  });

  if (!response.ok) {
    console.error('PayU database request failed', response.status, path);
    throw new Error('Unable to process the payment request.');
  }

  const responseBody = await response.text();
  if (!responseBody.trim()) return undefined as T;

  try {
    return JSON.parse(responseBody) as T;
  } catch {
    throw new Error('The database returned an invalid response while processing the payment.');
  }
}

function amountString(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('The selected subscription plan has an invalid price.');
  }
  return amount.toFixed(2);
}

async function sha512(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function callbackUrl(supabaseUrl: string): string {
  const url = new URL('/functions/v1/payu-payment?action=callback', supabaseUrl);
  return url.toString();
}

async function createPayment(req: Request): Promise<Response> {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const payuKey = requiredEnv('PAYU_KEY');
  const payuSalt = requiredEnv('PAYU_SALT');
  const appUrl = requiredEnv('PAYU_APP_URL');
  const environment = requiredEnv('PAYU_ENVIRONMENT');
  if (environment !== 'test' && environment !== 'production') {
    throw new Error('PAYU_ENVIRONMENT must be either test or production.');
  }

  let appOrigin: string;
  try {
    const parsedAppUrl = new URL(appUrl);
    if (parsedAppUrl.protocol !== 'https:' && parsedAppUrl.hostname !== 'localhost') {
      throw new Error('PAYU_APP_URL must use HTTPS.');
    }
    appOrigin = parsedAppUrl.origin;
  } catch {
    throw new Error('PAYU_APP_URL must be a valid HTTPS application URL.');
  }

  const requestOrigin = req.headers.get('origin');
  if (requestOrigin && !configuredOrigins().has(requestOrigin)) {
    return jsonResponse({ error: 'Request origin is not allowed.' }, 403, corsHeaders(req));
  }

  const body = await req.json();
  if (
    typeof body.shop_id !== 'string' ||
    !body.shop_id ||
    typeof body.plan_id !== 'string' ||
    !body.plan_id
  ) {
    return jsonResponse({ error: 'A shop and subscription plan are required.' }, 400, corsHeaders(req));
  }

  const shopRows = await supabaseRequest<
    Array<{ id: string; name: string; status: string | null; contact_phone: string | null; phone: string | null }>
  >(
    `print_shops?select=id,name,status,contact_phone,phone&id=eq.${encodeURIComponent(body.shop_id)}&limit=1`,
    supabaseUrl,
    serviceRoleKey
  );
  const shop = shopRows[0];
  if (!shop || shop.status === 'disabled' || shop.status === 'inactive') {
    return jsonResponse({ error: 'This shop is unavailable for subscription payments.' }, 403, corsHeaders(req));
  }

  const accounts = await supabaseRequest<
    Array<{
      id: string;
      shop_id: string;
      email: string;
      owner_name: string;
      phone: string | null;
      status: string | null;
      is_active: boolean | null;
    }>
  >(
    `shopkeeper_accounts?select=id,shop_id,email,owner_name,phone,status,is_active&shop_id=eq.${encodeURIComponent(shop.id)}&limit=1`,
    supabaseUrl,
    serviceRoleKey
  );
  const account = accounts[0];
  if (
    !account ||
    account.shop_id !== shop.id ||
    account.status === 'disabled' ||
    account.status === 'inactive' ||
    account.is_active === false
  ) {
    return jsonResponse({ error: 'An active shopkeeper account is required.' }, 403, corsHeaders(req));
  }

  const plans = await supabaseRequest<
    Array<{ id: string; name: string; price: number | string; pc_limit: number; duration_days: number | null }>
  >(
    `subscription_plans?select=id,name,price,pc_limit,duration_days&id=eq.${encodeURIComponent(body.plan_id)}&is_active=eq.true&limit=1`,
    supabaseUrl,
    serviceRoleKey
  );
  const plan = plans[0];
  if (!plan) {
    return jsonResponse({ error: 'The selected subscription plan is unavailable.' }, 404, corsHeaders(req));
  }

  const email = account.email.trim();
  const phone = (account.phone || shop.contact_phone || shop.phone || '').replace(/\D/g, '');
  const firstName = (account.owner_name || shop.name || '').trim().slice(0, 60);
  if (!email || !phone || !firstName) {
    return jsonResponse(
      { error: 'Add the shopkeeper name, email, and phone number before paying.' },
      400,
      corsHeaders(req)
    );
  }

  const amount = amountString(plan.price);
  const durationDays = plan.duration_days === null ? 30 : Number(plan.duration_days);
  const pcLimit = Number(plan.pc_limit);
  if (!Number.isInteger(durationDays) || durationDays < 1 || !Number.isInteger(pcLimit) || pcLimit < 1) {
    throw new Error('The selected subscription plan has invalid settings.');
  }

  const txnid = `P24${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const productinfo = `Subscription - ${plan.name}`.slice(0, 100);
  const fields: Record<string, string> = {
    key: payuKey,
    txnid,
    amount,
    productinfo,
    firstname: firstName,
    email,
    phone,
    surl: callbackUrl(supabaseUrl),
    furl: callbackUrl(supabaseUrl),
    udf1: shop.id,
    udf2: account.id,
    udf3: plan.id,
    udf4: String(durationDays),
    udf5: String(pcLimit),
  };

  const hashString = [
    payuKey,
    txnid,
    amount,
    productinfo,
    firstName,
    email,
    fields.udf1,
    fields.udf2,
    fields.udf3,
    fields.udf4,
    fields.udf5,
    '',
    '',
    '',
    '',
    '',
    payuSalt,
  ].join('|');
  fields.hash = await sha512(hashString);

  await supabaseRequest(
    'payments',
    supabaseUrl,
    serviceRoleKey,
    {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: `pay_${txnid}`,
        order_id: `sub_${txnid}`,
        user_id: account.id,
        shop_id: shop.id,
        payu_txnid: txnid,
        payu_hash: fields.hash,
        amount,
        currency: 'INR',
        payment_method: 'PayU',
        payment_status: 'INITIATED',
        subscription_plan_id: plan.id,
        subscription_duration_days: durationDays,
        subscription_pc_limit: pcLimit,
      }),
    }
  );

  return jsonResponse(
    {
      payment_url:
        environment === 'production'
          ? 'https://secure.payu.in/_payment'
          : 'https://test.payu.in/_payment',
      fields,
    },
    200,
    corsHeaders(req)
  );
}

function appRedirect(result: 'success' | 'failure'): Response {
  const appUrl = new URL('/subscription', requiredEnv('PAYU_APP_URL'));
  appUrl.searchParams.set('payment', result);
  return Response.redirect(appUrl.toString(), 303);
}

async function handlePayUCallback(req: Request): Promise<Response> {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const payuKey = requiredEnv('PAYU_KEY');
  const payuSalt = requiredEnv('PAYU_SALT');

  const form = await req.formData();
  const value = (name: string) => {
    const entry = form.get(name);
    return typeof entry === 'string' ? entry : '';
  };

  const txnid = value('txnid');
  const responseHash = value('hash').toLowerCase();
  const status = value('status').toLowerCase();
  if (!txnid || !responseHash || value('key') !== payuKey) {
    throw new Error('PayU callback is missing required payment details.');
  }

  const udf1 = value('udf1');
  const udf2 = value('udf2');
  const udf3 = value('udf3');
  const udf4 = value('udf4');
  const udf5 = value('udf5');
  const additionalCharges = value('additionalCharges') || value('additional_charges');
  const reverseHashParts = [
    payuSalt,
    status,
    value('udf10'),
    value('udf9'),
    value('udf8'),
    value('udf7'),
    value('udf6'),
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    value('email'),
    value('firstname'),
    value('productinfo'),
    value('amount'),
    txnid,
    payuKey,
  ];
  const expectedHash = await sha512(
    additionalCharges
      ? [additionalCharges, ...reverseHashParts].join('|')
      : reverseHashParts.join('|')
  );
  if (!constantTimeEqual(responseHash, expectedHash)) {
    throw new Error('PayU response hash verification failed.');
  }

  const transactions = await supabaseRequest<
    Array<{
      id: string;
      payu_txnid: string;
      shop_id: string;
      user_id: string;
      amount: number | string;
      subscription_plan_id: string;
      subscription_duration_days: number;
      subscription_pc_limit: number;
      payment_status: string;
      hash_verified: boolean;
    }>
  >(
    `payments?select=id,payu_txnid,shop_id,user_id,amount,subscription_plan_id,subscription_duration_days,subscription_pc_limit,payment_status,hash_verified&payu_txnid=eq.${encodeURIComponent(txnid)}&limit=1`,
    supabaseUrl,
    serviceRoleKey
  );
  const payment = transactions[0];
  if (
    !payment ||
    payment.payu_txnid !== txnid ||
    amountString(payment.amount) !== amountString(value('amount')) ||
    payment.shop_id !== udf1 ||
    payment.user_id !== udf2 ||
    payment.subscription_plan_id !== udf3 ||
    String(payment.subscription_duration_days) !== udf4 ||
    String(payment.subscription_pc_limit) !== udf5
  ) {
    throw new Error('PayU response does not match the initiated transaction.');
  }

  if (status === 'success') {
    const mihpayid = value('mihpayid');
    if (!mihpayid) throw new Error('PayU success response is missing its payment reference.');

    const result = await supabaseRequest<unknown>(
      'rpc/complete_payu_subscription',
      supabaseUrl,
      serviceRoleKey,
      {
        method: 'POST',
        body: JSON.stringify({
          p_txnid: txnid,
          p_mihpayid: mihpayid,
          p_bank_ref_num: value('bank_ref_num'),
          p_unmappedstatus: value('unmappedstatus'),
        }),
      }
    );
    if (!result) throw new Error('The verified payment could not activate the subscription.');
    return appRedirect('success');
  }

  await supabaseRequest(
    `payments?id=eq.${encodeURIComponent(payment.id)}&payment_status=neq.PAID`,
    supabaseUrl,
    serviceRoleKey,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payu_mihpayid: value('mihpayid') || null,
        payment_status: 'FAILED',
        hash_verified: true,
        unmappedstatus: value('unmappedstatus') || null,
        error: value('error') || null,
        error_message: value('error_Message') || null,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return appRedirect('failure');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const action = new URL(req.url).searchParams.get('action');
    if (action === 'callback' && req.method === 'POST') {
      return await handlePayUCallback(req);
    }
    if (req.method === 'POST') {
      const body = await req.clone().json();
      if (body.action === 'create') return await createPayment(req);
    }
    return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders(req));
  } catch (error) {
    console.error('PayU payment request failed:', error);
    if (new URL(req.url).searchParams.get('action') === 'callback') {
      try {
        return appRedirect('failure');
      } catch {
        return new Response('Payment verification failed.', { status: 400 });
      }
    }
    const message = error instanceof Error ? error.message : 'Unable to process the payment request.';
    return jsonResponse({ error: message }, 500, corsHeaders(req));
  }
});
