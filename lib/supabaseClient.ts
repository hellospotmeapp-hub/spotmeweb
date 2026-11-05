import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

export const supabaseUrl = 'https://wjhxrpwobnyntokegrtx.supabase.co';

export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHhycHdvYm55bnRva2VncnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU2MzUsImV4cCI6MjA4NzA1MTYzNX0.g48dLZoH6ZNbmSv9emGuvYvLgFIQm33xjCbtwvEZB_0';

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
