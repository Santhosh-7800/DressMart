const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasRealCredentials = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-anon-public-key'),
);

export const env = {
  supabaseUrl: supabaseUrl ?? '',
  supabaseAnonKey: supabaseAnonKey ?? '',
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:5173',
  /**
   * DressMart runs fully in "mock mode" (seeded, in-browser data via localStorage)
   * until real Supabase credentials are provided in `.env`. This lets `npm run dev`
   * work immediately after clone, and the switch to a live backend is transparent
   * because every feature module reads from `services/*`, never from Supabase directly.
   */
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true' || !hasRealCredentials,
};
