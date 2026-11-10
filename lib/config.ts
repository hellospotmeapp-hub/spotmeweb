// Build-time environment. Debug builds (__DEV__) use the staging Supabase project with
// Stripe TEST keys; release builds and the production website use production with LIVE keys.
// EXPO_PUBLIC_* values must be read with static property access so Expo can inline them.

const PROD_SUPABASE_URL = 'https://wjhxrpwobnyntokegrtx.supabase.co';
const PROD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHhycHdvYm55bnRva2VncnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU2MzUsImV4cCI6MjA4NzA1MTYzNX0.g48dLZoH6ZNbmSv9emGuvYvLgFIQm33xjCbtwvEZB_0';

const devUrl = process.env.EXPO_PUBLIC_SUPABASE_URL_DEV || '';
const devAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_DEV || '';

// Without a staging project, debug builds talk to production, so they must use the live key too
export const useStaging = __DEV__ && !!devUrl && !!devAnonKey;

export const supabaseUrl = useStaging ? devUrl : PROD_SUPABASE_URL;
export const supabaseKey = useStaging ? devAnonKey : PROD_SUPABASE_ANON_KEY;

// EXPO_PUBLIC_STRIPE_TEST_MODE=true forces Stripe test keys in debug builds (the server's
// STRIPE_SECRET_KEY must be the sk_test key too); release builds always keep the live key
const forceStripeTest = __DEV__ && process.env.EXPO_PUBLIC_STRIPE_TEST_MODE === 'true';

export const stripePublishableKey = (useStaging || forceStripeTest
  ? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST
  : process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) || '';

export const stripeTestMode = stripePublishableKey.startsWith('pk_test_');

if (__DEV__) {
  console.log(`[SpotMe] backend: ${useStaging ? 'staging' : 'PRODUCTION'} (${supabaseUrl}), Stripe ${stripeTestMode ? 'test' : 'LIVE'}`);
}
