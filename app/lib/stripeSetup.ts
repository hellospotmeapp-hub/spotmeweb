/**
 * Stripe Setup Checker
 * 
 * Tests whether the PostgreSQL RPC functions for Stripe are available.
 * These functions are created by running SQL in the Supabase SQL Editor
 * (see DEPLOY_EDGE_FUNCTIONS.md, Step 3).
 */

import { supabaseClient as supabase } from './supabaseClient';

export interface StripeSetupStatus {
  isConfigured: boolean;
  rpcAvailable: boolean;
  stripeKeyValid: boolean;
  httpExtensionAvailable: boolean;
  error?: string;
  details?: string;
}

let cachedStatus: StripeSetupStatus | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Check if Stripe is properly configured by testing the RPC functions.
 * Results are cached for 1 minute.
 */
export async function checkStripeSetup(forceRefresh = false): Promise<StripeSetupStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && (now - lastCheckTime) < CACHE_DURATION) {
    return cachedStatus;
  }

  try {
    // Test 1: Try to create a minimal PaymentIntent ($0.50 = 50 cents, the minimum)
    // We use a very small amount to test. This will be immediately cancelled.
    const { data, error } = await supabase.rpc('spotme_create_payment_intent', {
      p_amount_cents: 50,
      p_currency: 'usd',
      p_metadata: { test: 'setup_check' },
      p_destination: null,
      p_application_fee_cents: null,
    });

    if (error) {
      const msg = error.message || '';
      
      // Function doesn't exist
      if (msg.includes('Could not find') || msg.includes('does not exist') || msg.includes('function') || msg.includes('42883')) {
        cachedStatus = {
          isConfigured: false,
          rpcAvailable: false,
          stripeKeyValid: false,
          httpExtensionAvailable: false,
          error: 'SQL functions not created',
          details: 'Run the SQL from Step 3 of the setup guide in your Supabase SQL Editor to create the Stripe RPC functions.',
        };
        lastCheckTime = now;
        return cachedStatus;
      }

      // HTTP extension not available
      if (msg.includes('http') || msg.includes('extension')) {
        cachedStatus = {
          isConfigured: false,
          rpcAvailable: true,
          stripeKeyValid: false,
          httpExtensionAvailable: false,
          error: 'HTTP extension not enabled',
          details: 'Run this SQL in your Supabase SQL Editor: CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;',
        };
        lastCheckTime = now;
        return cachedStatus;
      }

      // Stripe key error
      if (msg.includes('Invalid API Key') || msg.includes('REPLACE_ME') || msg.includes('authentication')) {
        cachedStatus = {
          isConfigured: false,
          rpcAvailable: true,
          stripeKeyValid: false,
          httpExtensionAvailable: true,
          error: 'Stripe secret key not configured',
          details: 'Update the spotme_get_stripe_key() function with your actual Stripe test secret key (sk_test_...).',
        };
        lastCheckTime = now;
        return cachedStatus;
      }

      // Other error
      cachedStatus = {
        isConfigured: false,
        rpcAvailable: false,
        stripeKeyValid: false,
        httpExtensionAvailable: false,
        error: msg,
        details: 'An unexpected error occurred. Check the Supabase logs for details.',
      };
      lastCheckTime = now;
      return cachedStatus;
    }

    // If we got data back, check if it looks like a PaymentIntent
    if (data && data.id && data.client_secret) {
      // Success! Stripe is configured and working.
      // Cancel the test PaymentIntent (best effort)
      try {
        await supabase.rpc('spotme_cancel_payment_intent', {
          p_payment_intent_id: data.id,
        });
      } catch {
        // If cancel function doesn't exist, that's OK - the PI will expire
      }

      cachedStatus = {
        isConfigured: true,
        rpcAvailable: true,
        stripeKeyValid: true,
        httpExtensionAvailable: true,
      };
      lastCheckTime = now;
      return cachedStatus;
    }

    // Got data but it doesn't look right
    if (data && data.error) {
      const stripeError = data.error?.message || data.error?.type || 'Unknown Stripe error';
      cachedStatus = {
        isConfigured: false,
        rpcAvailable: true,
        stripeKeyValid: false,
        httpExtensionAvailable: true,
        error: `Stripe API error: ${stripeError}`,
        details: 'The RPC function works but Stripe returned an error. Check your Stripe secret key.',
      };
      lastCheckTime = now;
      return cachedStatus;
    }

    // Unexpected response
    cachedStatus = {
      isConfigured: false,
      rpcAvailable: true,
      stripeKeyValid: false,
      httpExtensionAvailable: true,
      error: 'Unexpected response from Stripe',
      details: 'The RPC function returned an unexpected response. Check the function implementation.',
    };
    lastCheckTime = now;
    return cachedStatus;

  } catch (err: any) {
    cachedStatus = {
      isConfigured: false,
      rpcAvailable: false,
      stripeKeyValid: false,
      httpExtensionAvailable: false,
      error: err.message || 'Setup check failed',
      details: 'Could not connect to the database. Check your Supabase configuration.',
    };
    lastCheckTime = now;
    return cachedStatus;
  }
}

/**
 * Quick check - returns cached status or defaults to unchecked
 */
export function getStripeSetupStatus(): StripeSetupStatus | null {
  return cachedStatus;
}

/**
 * Clear the cached status (e.g., after user says they've run the SQL)
 */
export function clearStripeSetupCache() {
  cachedStatus = null;
  lastCheckTime = 0;
}

/**
 * Get the SQL setup instructions for display in the app
 */
export function getSetupInstructions(): { step: number; title: string; description: string; sql?: string }[] {
  return [
    {
      step: 1,
      title: 'Open Supabase SQL Editor',
      description: 'Go to your Supabase dashboard → SQL Editor → New Query',
    },
    {
      step: 2,
      title: 'Enable HTTP Extension',
      description: 'Paste and run this SQL:',
      sql: 'CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;',
    },
    {
      step: 3,
      title: 'Create Stripe Functions',
      description: 'Copy the SQL from DEPLOY_EDGE_FUNCTIONS.md Step 3 and paste it into the SQL Editor. Replace sk_test_REPLACE_ME_WITH_YOUR_STRIPE_SECRET_KEY with your actual Stripe test secret key.',
    },
    {
      step: 4,
      title: 'Test It',
      description: 'Come back here and tap "Check Setup" to verify everything is working.',
    },
  ];
}
