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
// The LOCAL invoke function — always available, never depends on override
// ============================================================
async function localInvoke(functionName: string, options?: any): Promise<any> {
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
        body: JSON.stringify(body || {}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try { errorData = JSON.parse(errorText); } catch { errorData = { error: errorText }; }
        console.error(`[SpotMe] Remote ${functionName} error ${response.status}:`, errorData);
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
}

// ============================================================
// INTERCEPT: Override supabase.functions.invoke
// ============================================================
const localFunctionsClient = {
  invoke: localInvoke,
  setAuth: () => {},
  url: '',
  headers: {},
};

// Try multiple approaches to override supabase.functions
let overrideSucceeded = false;

// Approach 1: Object.defineProperty
try {
  Object.defineProperty(supabase, 'functions', {
    value: localFunctionsClient,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  if (supabase.functions === localFunctionsClient) {
    overrideSucceeded = true;
  }
} catch (e) {}

// Approach 2: Direct assignment
if (!overrideSucceeded) {
  try {
    (supabase as any).functions = localFunctionsClient;
    if ((supabase as any).functions === localFunctionsClient) {
      overrideSucceeded = true;
    }
  } catch (e) {}
}

// Approach 3: Prototype-level override
if (!overrideSucceeded) {
  try {
    const proto = Object.getPrototypeOf(supabase);
    if (proto) {
      Object.defineProperty(proto, 'functions', {
        get: () => localFunctionsClient,
        configurable: true,
      });
      overrideSucceeded = true;
    }
  } catch (e) {}
}

// Approach 4: Monkey-patch the existing invoke method
if (!overrideSucceeded) {
  try {
    const existingFunctions = supabase.functions;
    if (existingFunctions && typeof existingFunctions.invoke === 'function') {
      const originalInvoke = existingFunctions.invoke.bind(existingFunctions);
      (existingFunctions as any).invoke = async (functionName: string, options?: any) => {
        // Always use our local handler
        return localInvoke(functionName, options);
      };
      overrideSucceeded = true;
      console.log('[SpotMe] Monkey-patched supabase.functions.invoke');
    }
  } catch (e) {}
}

if (overrideSucceeded) {
  console.log('[SpotMe] supabase.functions.invoke intercepted (hybrid mode: remote for payments, local for rest)');
} else {
  console.warn('[SpotMe] WARNING: Could not override supabase.functions. Use safeInvoke for all calls.');
}

/**
 * Safari-safe wrapper for supabase.functions.invoke
 * ALWAYS uses the local handler directly — never depends on the supabase.functions override.
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

    // ALWAYS use localInvoke directly — never rely on the override
    const resultPromise = localInvoke(functionName, options);
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
