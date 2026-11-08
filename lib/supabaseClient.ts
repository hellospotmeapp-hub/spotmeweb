import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

import { supabaseUrl, supabaseKey } from './config';

export { supabaseUrl, supabaseKey };

export const supabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Web keeps the session in localStorage; native apps persist it with AsyncStorage
    ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Native: only refresh the session token while the app is in the foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabaseClient.auth.startAutoRefresh();
    else supabaseClient.auth.stopAutoRefresh();
  });
}
