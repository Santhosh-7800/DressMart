import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Single Supabase client instance for the whole app.
 * In mock mode (no real project configured yet) this client is still created
 * so imports don't break, but `services/*` route reads/writes to the local
 * mock data layer instead of calling out to it — see services/mock/*.
 */
export const supabase = createClient(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  },
);
