function getStringField(value: unknown, fields: string[]): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;

  for (const field of fields) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }

  return undefined;
}

export async function createFunctionError(response: Response, operation: string): Promise<Error> {
  if (response.status !== 503) {
    return new Error(`${operation} failed (${response.status})`);
  }

  const body = await response.text();
  let bodyData: unknown;
  try {
    bodyData = JSON.parse(body);
  } catch {
    bodyData = undefined;
  }

  const errorCode =
    response.headers.get('sb-error-code') ||
    response.headers.get('x-sb-error-code') ||
    getStringField(bodyData, ['sb_error_code', 'error_code', 'code']) ||
    body.match(/SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED/)?.[0] ||
    'unavailable';
  const requestId =
    response.headers.get('sb-request-id') ||
    response.headers.get('x-request-id') ||
    getStringField(bodyData, ['request_id', 'requestId']) ||
    'unavailable';

  return new Error(
    `${operation} failed (503): Supabase Edge Runtime may be temporarily degraded. Retry once manually; if it persists, contact Supabase Support with request_id=${requestId} and sb_error_code=${errorCode}.`
  );
}
