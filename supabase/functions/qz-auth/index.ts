declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(name: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signToken(payload: { sub: string; shop_id: string; exp: number }, secret: string): Promise<string> {
  const payloadPart = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadPart));
  return `${payloadPart}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function response(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(JSON.stringify({ error: 'Method not allowed' }), 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const tokenSecret = Deno.env.get('QZ_AUTH_SECRET');
    if (!supabaseUrl || !serviceRoleKey || !tokenSecret || tokenSecret.length < 32) {
      return response(JSON.stringify({ error: 'QZ authorization is not configured' }), 500);
    }

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const trustedDeviceToken =
      typeof body.trusted_device_token === 'string' ? body.trusted_device_token : '';

    if (password.length > 1024 || (!trustedDeviceToken && (!email || !password))) {
      return response(JSON.stringify({ error: 'Invalid credentials' }), 400);
    }

    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };
    let accountId: string | undefined;

    if (trustedDeviceToken) {
      const tokenHash = await sha256(`${trustedDeviceToken}_printon24_salt`);
      const devicesUrl = new URL(`${supabaseUrl}/rest/v1/trusted_devices`);
      devicesUrl.searchParams.set('select', 'shopkeeper_id');
      devicesUrl.searchParams.set('token_hash', `eq.${tokenHash}`);
      devicesUrl.searchParams.set('limit', '1');
      const deviceResponse = await fetch(devicesUrl, { headers });
      if (!deviceResponse.ok) throw new Error('Unable to verify trusted device');
      const devices = await deviceResponse.json();
      accountId = devices[0]?.shopkeeper_id;
    } else {
      const accountsUrl = new URL(`${supabaseUrl}/rest/v1/shopkeeper_accounts`);
      accountsUrl.searchParams.set('select', 'id,shop_id,password_hash,status,is_active');
      accountsUrl.searchParams.set('email', `eq.${email}`);
      accountsUrl.searchParams.set('limit', '1');
      const accountResponse = await fetch(accountsUrl, { headers });
      if (!accountResponse.ok) throw new Error('Unable to verify account');
      const accounts = await accountResponse.json();
      const account = accounts[0];
      if (!account) return response(JSON.stringify({ error: 'Invalid credentials' }), 401);

      const passwordHash = await sha256(`${password}_printon24_salt`);
      if (account.password_hash !== password && account.password_hash !== passwordHash) {
        return response(JSON.stringify({ error: 'Invalid credentials' }), 401);
      }
      accountId = account.id;
    }

    if (!accountId) return response(JSON.stringify({ error: 'Invalid credentials' }), 401);

    const accountUrl = new URL(`${supabaseUrl}/rest/v1/shopkeeper_accounts`);
    accountUrl.searchParams.set('select', 'id,shop_id,status,is_active');
    accountUrl.searchParams.set('id', `eq.${accountId}`);
    accountUrl.searchParams.set('limit', '1');
    const accountResponse = await fetch(accountUrl, { headers });
    if (!accountResponse.ok) throw new Error('Unable to verify account status');
    const accounts = await accountResponse.json();
    const account = accounts[0];
    if (!account || account.status === 'disabled' || account.status === 'inactive' || account.is_active === false) {
      return response(JSON.stringify({ error: 'Account is inactive' }), 403);
    }

    const token = await signToken(
      { sub: account.id, shop_id: account.shop_id, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 },
      tokenSecret
    );
    return response(JSON.stringify({ token }), 200);
  } catch (err) {
    console.error('QZ authorization failed:', err);
    return response(JSON.stringify({ error: 'QZ authorization failed' }), 500);
  }
});
