# PayU subscription payments

The subscription checkout uses the PayU hosted payment page. The PayU salt and
hash generation stay in the `payu-payment` Supabase Edge Function; never add
them to a `VITE_` variable, the browser bundle, or source control.

## Configure and deploy

1. Rotate any PayU salt that was previously placed in application SQL/source or
   exposed in chat. Do not put PayU secrets in the frontend `.env` file.
2. Set the PayU credentials and the public URL of this app as Supabase secrets:

   ```sh
   supabase secrets set PAYU_KEY=your_key PAYU_SALT=your_new_salt PAYU_ENVIRONMENT=test PAYU_APP_URL=https://your-app.example
   ```

   Use `PAYU_ENVIRONMENT=production` only after PayU enables the live account.
   `PAYU_APP_URL` is the deployed app origin (no `/subscription` suffix). For
   local development, add its exact origin, such as `http://localhost:5173`, to
   `PAYU_ALLOWED_ORIGINS` (comma-separated if multiple):

   ```sh
   supabase secrets set PAYU_ALLOWED_ORIGINS=http://localhost:5173
   ```

3. Apply the database migration and deploy the Edge Function:

   ```sh
   supabase db push
   supabase functions deploy payu-payment
   ```

4. In PayU, use the function's callback URL for both success and failure
   callbacks:
   `https://<project-ref>.supabase.co/functions/v1/payu-payment?action=callback`

The function creates the amount from the active database plan and activates the
subscription only after verifying PayU's response hash and matching it to the
stored transaction. This app's current shopkeeper login is a client-side
session, so the function additionally checks that the requested shop has an
active shopkeeper account; this does not replace server-authenticated user
sessions.
