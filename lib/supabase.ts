import { supabaseClient, supabaseUrl, supabaseKey } from './supabaseClient';

// Re-export the client as 'supabase' for backward compatibility
const supabase = supabaseClient;

// ============================================================
// All backend logic runs in the `api` Edge Function. Every
// supabase.functions.invoke(name, { body }) call is forwarded there as
// { fn: name, body }, authenticated with the signed-in user's session.
// ============================================================
async function remoteInvoke(functionName: string, options?: any): Promise<{ data: any; error: any }> {
  try {
    let token = supabaseKey;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.access_token) token = session.access_token;
    } catch {}

    const response = await fetch(`${supabaseUrl}/functions/v1/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ fn: functionName, body: options?.body || {} }),
    });

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }

    // Handlers report business errors as { success: false, error } — pass those through as data
    if (!response.ok && typeof data?.success === 'undefined') {
      return { data: null, error: { message: data?.error || data?.message || `Server error: ${response.status}` } };
    }
    return { data, error: null };
  } catch (err: any) {
    console.error(`[SpotMe] ${functionName} request failed:`, err?.message);
    return { data: null, error: { message: err?.message || 'Network error' } };
  }
}

// ============================================================
// INTERCEPT: Override supabase.functions.invoke
// ============================================================
const apiFunctionsClient = {
  invoke: remoteInvoke,
  setAuth: () => {},
  url: '',
  headers: {},
};

let overrideSucceeded = false;

// Approach 1: Object.defineProperty
try {
  Object.defineProperty(supabase, 'functions', {
    value: apiFunctionsClient,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  if ((supabase as any).functions === apiFunctionsClient) {
    overrideSucceeded = true;
  }
} catch (e) {}

// Approach 2: Direct assignment
if (!overrideSucceeded) {
  try {
    (supabase as any).functions = apiFunctionsClient;
    if ((supabase as any).functions === apiFunctionsClient) {
      overrideSucceeded = true;
    }
  } catch (e) {}
}

// Approach 3: Monkey-patch the existing invoke method
if (!overrideSucceeded) {
  try {
    const existingFunctions = supabase.functions;
    if (existingFunctions && typeof existingFunctions.invoke === 'function') {
      (existingFunctions as any).invoke = remoteInvoke;
      overrideSucceeded = true;
    }
  } catch (e) {}
}

if (!overrideSucceeded) {
  console.warn('[SpotMe] WARNING: Could not override supabase.functions. Use safeInvoke for all calls.');
}

/**
 * Safari-safe wrapper around the API call, with a timeout.
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

    const result = await Promise.race([remoteInvoke(functionName, options), timeoutPromise]);

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
