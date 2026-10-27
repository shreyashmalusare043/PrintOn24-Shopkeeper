import { supabase } from './supabase';

interface PayUCheckoutResponse {
  payment_url: string;
  fields: Record<string, string>;
}

export const payuService = {
  async openSubscriptionCheckout(shopId: string, planId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke<PayUCheckoutResponse>('payu-payment', {
      body: { action: 'create', shop_id: shopId, plan_id: planId },
    });

    if (error) {
      if (error.name === 'FunctionsFetchError') {
        throw new Error(
          'Could not reach the PayU Edge Function. Check the browser origin against PAYU_APP_URL or PAYU_ALLOWED_ORIGINS, then confirm the function is deployed to this Supabase project.'
        );
      }

      const errorWithContext = error as Error & { context?: unknown };
      if (errorWithContext.context instanceof Response) {
        const response = errorWithContext.context;
        const responseText = await response.clone().text();
        let responseMessage = '';

        try {
          const responseBody: unknown = JSON.parse(responseText);
          if (
            responseBody &&
            typeof responseBody === 'object' &&
            'error' in responseBody &&
            typeof responseBody.error === 'string'
          ) {
            responseMessage = responseBody.error;
          }
        } catch {
          responseMessage = responseText.trim();
        }

        throw new Error(
          responseMessage
            ? `PayU checkout failed (${response.status}): ${responseMessage}`
            : `PayU checkout failed with status ${response.status}: ${error.message}`
        );
      }

      throw new Error(`Unable to start PayU checkout: ${error.message}`);
    }

    if (!data?.payment_url || !data.fields) {
      throw new Error('PayU checkout could not be initialized. Please try again.');
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.payment_url;
    form.style.display = 'none';

    for (const [name, value] of Object.entries(data.fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  },
};
