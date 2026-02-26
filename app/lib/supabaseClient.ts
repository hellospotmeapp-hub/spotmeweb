import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallback to hardcoded values
export const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_database_URL) ||
  'https://wadkuixhehslrteepluf.databasepad.com';

export const supabaseKey =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_database_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRhNDhjOGQ1LWM2NGEtNGM5Ni04YWJiLWNhOGIxNzBhYzBmYyJ9.eyJwcm9qZWN0SWQiOiJ3YWRrdWl4aGVoc2xydGVlcGx1ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcxMDM2ODc1LCJleHAiOjIwODYzOTY4NzUsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.8D4-YKtj3LLq5nDrGKY2mDnG7CqfeliSBh4XLgJq88c';

export const supabaseClient = createClient(supabaseUrl, supabaseKey);
