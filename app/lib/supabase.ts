import { supabaseClient, supabaseUrl, supabaseKey } from './supabaseClient';
import { handleFunctionCall } from './api';

// Re-export the client as 'supabase' for backward compatibility
const supabase = supabaseClient;

// ============================================================
// FUNCTIONS THAT MUST GO TO REAL EDGE FUNCTIONS
// (These need server-side secrets like GATEWAY_API_KEY, STRIPE_SECRET_KEY)
// ============================================================
const REMOTE_FUNCTIONS = new Set([
  'stripe-checkout',
  'stripe-connect',
]);

// ============================================================
// INTERCEPT: Route function calls — remote for payments, local for everything else
// ============================================================
const localFunctionsClient = {
  invoke: async (functionName: string, options?: any): Promise<any> => {
    const body = options?.body;

    // Route payment functions to real edge functions (they need server-side API keys)
    if (REMOTE_FUNCTIONS.has(functionName)) {
      console.log(`[SpotMe] Routing ${functionName} → REMOTE edge function (action: ${body?.action})`);
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData: any;
          try { errorData = JSON.parse(errorText); } catch { errorData = { error: errorText }; }
          console.error(`[SpotMe] Remote ${functionName} error ${response.status}:`, errorData);
          // If the response has a success field, return it as data (edge function returned structured error)
          if (errorData && typeof errorData.success !== 'undefined') {
            return { data: errorData, error: null };
          }
          return { data: null, error: { message: errorData?.error || errorData?.message || `Edge function error: ${response.status}` } };
        }

        const data = await response.json();
        return { data, error: null };
      } catch (err: any) {
        console.error(`[SpotMe] Remote ${functionName} fetch error:`, err.message);
        return { data: null, error: { message: err.message || 'Network error calling edge function' } };
      }
    }

    // Route everything else to local API handler
    console.log(`[SpotMe] Routing ${functionName} → local API (action: ${body?.action})`);
    try {
      const result = await handleFunctionCall(functionName, body);
      return result;
    } catch (err: any) {
      console.error(`[SpotMe] Local API error for ${functionName}:`, err);
      return { data: null, error: { message: err.message || 'Local API call failed' } };
    }
  },
  // Stub out other FunctionsClient methods
  setAuth: () => {},
  url: '',
  headers: {},
};

// Replace the `functions` getter with our hybrid handler
try {
  Object.defineProperty(supabase, 'functions', {
    value: localFunctionsClient,
    writable: true,
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  try {
    (supabase as any).functions = localFunctionsClient;
  } catch (e2) {
    console.error('[SpotMe] Could not override supabase.functions:', e2);
  }
}

// Verify the override worked
const testRef = supabase.functions;
if (testRef && typeof testRef.invoke === 'function' && testRef === localFunctionsClient) {
  console.log('[SpotMe] supabase.functions.invoke intercepted (hybrid mode: remote for payments, local for rest)');
} else {
  console.warn('[SpotMe] supabase.functions override may not have worked. Applying fallback patch...');
  try {
    const proto = Object.getPrototypeOf(supabase);
    if (proto) {
      Object.defineProperty(proto, 'functions', {
        get: () => localFunctionsClient,
        configurable: true,
      });
      console.log('[SpotMe] Prototype-level override applied');
    }
  } catch (e3) {
    console.error('[SpotMe] All override attempts failed:', e3);
  }
}

/**
 * Safari-safe wrapper for supabase.functions.invoke
 * Routes through the hybrid handler (remote for payments, local for rest).
 */
async function safeInvoke(
  functionName: string,
  options: { body: any },
  timeoutMs: number = 10000
): Promise<{ data: any; error: any }> {
  try {
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => {
        resolve({ 
          data: null, 
          error: { message: `Request timed out after ${timeoutMs / 1000}s` } 
        });
      }, timeoutMs);
    });

    // Use the hybrid handler for all calls
    const resultPromise = localFunctionsClient.invoke(functionName, options);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (result.error) {
      const errMsg = typeof result.error === 'string' 
        ? result.error 
        : result.error?.message || 'Server error';
      console.log(`[SpotMe] ${functionName} error:`, errMsg);
      return { data: null, error: { message: errMsg } };
    }

    return { data: result.data, error: null };
  } catch (err: any) {
    let errorMessage = 'Network error';
    if (err?.name === 'AbortError' || err?.code === 20) {
      errorMessage = 'Request timed out';
    } else if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
      errorMessage = 'Network request failed (check connection)';
    } else if (err?.name === 'TypeError' && err?.message?.includes('Load failed')) {
      errorMessage = 'Network request failed (Safari)';
    } else if (err?.message) {
      errorMessage = err.message;
    }
    console.log(`[SpotMe] ${functionName} caught error:`, errorMessage);
    return { data: null, error: { message: errorMessage } };
  }
}

export { supabase, supabaseUrl, supabaseKey, safeInvoke };
