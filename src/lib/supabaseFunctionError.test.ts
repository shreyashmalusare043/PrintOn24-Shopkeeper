import { describe, expect, it } from 'vitest';
import { createFunctionError } from './supabaseFunctionError';

describe('createFunctionError', () => {
  it('includes Supabase diagnostic headers for a degraded runtime response', async () => {
    const response = new Response('', {
      status: 503,
      headers: {
        'sb-error-code': 'SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED',
        'sb-request-id': 'request-123',
      },
    });

    const error = await createFunctionError(response, 'Signing request');

    expect(error.message).toContain(
      'request_id=request-123 and sb_error_code=SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED'
    );
  });

  it('reads diagnostic fields from the response body when headers are absent', async () => {
    const response = new Response(
      JSON.stringify({
        request_id: 'request-from-body',
        sb_error_code: 'SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED',
      }),
      { status: 503 }
    );

    const error = await createFunctionError(response, 'Certificate fetch');

    expect(error.message).toContain(
      'request_id=request-from-body and sb_error_code=SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED'
    );
  });

  it('preserves the concise status error for non-503 responses', async () => {
    const response = new Response('Unauthorized', { status: 401 });

    const error = await createFunctionError(response, 'Signing request');

    expect(error.message).toBe('Signing request failed (401)');
  });
});
