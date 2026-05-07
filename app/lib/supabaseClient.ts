import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://wjhxrpwobnyntokegrtx.supabase.co';

export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHhycHdvYm55bnRva2VncnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU2MzUsImV4cCI6MjA4NzA1MTYzNX0.g48dLZoH6ZNbmSv9emGuvYvLgFIQm33xjCbtwvEZB_0';

export const supabaseClient = createClient(supabaseUrl, supabaseKey);
