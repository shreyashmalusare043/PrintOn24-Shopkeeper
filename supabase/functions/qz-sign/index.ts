declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(name: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-qz-auth',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const encoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyQzToken(token: string, secret: string): Promise<{ sub: string; shop_id: string } | null> {
  try {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureBytes = decodeBase64Url(signaturePart);
    const signatureBuffer = new ArrayBuffer(signatureBytes.byteLength);
    new Uint8Array(signatureBuffer).set(signatureBytes);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      encoder.encode(payloadPart)
    );
    if (!isValid) return null;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart)));
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.shop_id !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { sub: payload.sub, shop_id: payload.shop_id };
  } catch {
    return null;
  }
}

async function isAccountActive(
  userId: string,
  shopId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<boolean> {
  const accountUrl = new URL(`${supabaseUrl}/rest/v1/shopkeeper_accounts`);
  accountUrl.searchParams.set('select', 'shop_id,status,is_active');
  accountUrl.searchParams.set('id', `eq.${userId}`);
  accountUrl.searchParams.set('limit', '1');
  const response = await fetch(accountUrl, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) throw new Error('Unable to verify shopkeeper account');
  const accounts = await response.json();
  const account = accounts[0];
  return Boolean(
    account &&
      account.shop_id === shopId &&
      account.status !== 'disabled' &&
      account.status !== 'inactive' &&
      account.is_active !== false
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const tokenSecret = Deno.env.get('QZ_AUTH_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const token = req.headers.get('x-qz-auth') || '';
    if (!tokenSecret || tokenSecret.length < 32 || !supabaseUrl || !serviceRoleKey) {
      return new Response('QZ authorization is not configured', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
    const identity = await verifyQzToken(token, tokenSecret);
    if (!identity || !(await isAccountActive(identity.sub, identity.shop_id, supabaseUrl, serviceRoleKey))) {
      return new Response('Unauthorized or expired QZ authorization. Please sign in again.', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // 1. Return Certificate
    if (req.method === 'GET' || action === 'certificate') {
      const certificate = Deno.env.get('QZ_CERTIFICATE');
      if (!certificate) {
        return new Response('Digital Certificate not found in environment secrets', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      return new Response(certificate, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // 2. Sign QZ Request
    if (req.method === 'POST') {
      let toSign = '';
      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const body = await req.json();
        toSign = body.request || body.toSign || '';
      } else {
        toSign = await req.text();
      }

      if (!toSign) {
        toSign = url.searchParams.get('request') || '';
      }

      if (!toSign) {
        return new Response('Missing request string to sign', {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      const privateKeyPem = Deno.env.get('QZ_PRIVATE_KEY');
      if (!privateKeyPem) {
        return new Response('Private key not found in environment secrets', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      // Clean PEM formatting
      const cleanKey = privateKeyPem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s+/g, '');

      const binaryDer = Uint8Array.from(atob(cleanKey), (c) => c.charCodeAt(0));

      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryDer.buffer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-512',
        },
        false,
        ['sign']
      );

      const dataToSign = new TextEncoder().encode(toSign);
      const signatureBuffer = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        dataToSign
      );

      // Convert signature to base64
      const signatureBytes = new Uint8Array(signatureBuffer);
      let binaryStr = '';
      for (let i = 0; i < signatureBytes.length; i++) {
        binaryStr += String.fromCharCode(signatureBytes[i]);
      }
      const signatureBase64 = btoa(binaryStr);

      return new Response(signatureBase64, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  } catch (err: any) {
    return new Response(err?.message || 'Signing failed', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
