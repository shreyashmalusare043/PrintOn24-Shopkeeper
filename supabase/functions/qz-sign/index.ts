const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
