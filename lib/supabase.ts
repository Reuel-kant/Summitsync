import { createClient } from '@supabase/supabase-js';

// Environment variables or fallback demo credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-summitsync.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_offline_and_demo_mode_fallbacks_only_never_use_in_prod';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
