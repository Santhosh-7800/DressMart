import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ResolvedTheme = 'light' | 'dark';
type ThemePreference = ResolvedTheme | 'system';

interface ThemeContextValue {
  /** The theme actually applied right now — resolves 'system' to the OS's current preference. */
  theme: ResolvedTheme;
  /** The user's stored choice, including 'system' — use this to drive Settings page button state. */
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'dressmart:theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Live-follows OS theme changes while the preference is 'system' — the old implementation only
  // ever checked matchMedia once (as a one-time default when nothing was stored yet), so switching
  // the OS theme mid-session had no effect until the user manually re-picked a theme.
  useEffect(() => {
    const mql = window.matchMedia(MEDIA_QUERY);
    const handleChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const theme: ResolvedTheme = themePreference === 'system' ? systemTheme : themePreference;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(STORAGE_KEY, themePreference);
  }, [theme, themePreference]);

  const setThemePreference = useCallback((next: ThemePreference) => setThemePreferenceState(next), []);
  const toggleTheme = useCallback(() => setThemePreferenceState((prev) => (prev === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(
    () => ({ theme, themePreference, setThemePreference, toggleTheme }),
    [theme, themePreference, setThemePreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
