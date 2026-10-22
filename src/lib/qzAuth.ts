export const QZ_AUTH_TOKEN_KEY = 'printon24_qz_auth_token';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qogdzcgvkwdnpkeejpef.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function getQzAuthToken(): string | null {
  return localStorage.getItem(QZ_AUTH_TOKEN_KEY);
}

export function clearQzAuthToken(): void {
  localStorage.removeItem(QZ_AUTH_TOKEN_KEY);
}

export async function issueQzAuthToken(credentials: {
  email?: string;
  password?: string;
  trustedDeviceToken?: string;
}): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/qz-auth`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      trusted_device_token: credentials.trustedDeviceToken,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`QZ authorization failed (${response.status}): ${message}`);
  }

  const result = (await response.json()) as { token?: string };
  if (!result.token) {
    throw new Error('QZ authorization response did not contain a token.');
  }
  localStorage.setItem(QZ_AUTH_TOKEN_KEY, result.token);
}
