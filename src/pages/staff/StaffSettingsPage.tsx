import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Sun, Moon, Globe, Bell } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { staffService } from '@/services/staffService';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

/** Account security (Change Password) lives on the My Profile page — this page is Staff's own
 *  Theme/Language/Notifications preferences, not store-wide settings (branding, shipping,
 *  policies, etc. stay Admin-only). See RequireStaffOnly / StaffLayout for the rest of that boundary. */
export function StaffSettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: details } = useQuery({ queryKey: ['staff', 'details', user?.id], queryFn: () => staffService.getDetails(user!.id), enabled: Boolean(user?.id) });

  const [language, setLanguage] = useState('en');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (details) {
      setLanguage(details.language);
      setNotificationsEnabled(details.notifications_enabled);
    }
  }, [details]);

  const savePreferences = useMutation({
    mutationFn: (updates: { language: string; notifications_enabled: boolean }) => staffService.savePreferences(user!.id, updates),
    onSuccess: () => toast.success('Preferences saved'),
    onError: (error: Error) => toast.error(error.message),
  });

  // Theme switches immediately (setTheme handles the <html> class + localStorage) and persists to
  // Supabase right away too, independent of the "Save Preferences" button below — so it survives
  // logging in again on a different device even if the user navigates away without saving.
  const saveTheme = useMutation({
    mutationFn: (next: 'light' | 'dark') => staffService.savePreferences(user!.id, { theme: next }),
    onError: (error: Error) => toast.error(error.message),
  });

  const selectTheme = (next: 'light' | 'dark') => {
    setTheme(next);
    saveTheme.mutate(next);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Seo title="Staff — Settings" />
      <div className="mb-1 flex items-center gap-2">
        <SettingsIcon size={22} className="text-admin-orange" />
        <h1 className="text-2xl font-bold text-admin-text">Settings</h1>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-4 font-semibold text-admin-text">Theme</h2>
        <div className="flex gap-3">
          <button
            onClick={() => selectTheme('light')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors duration-200',
              theme === 'light' ? 'border-admin-orange bg-admin-orange/10 text-admin-orange' : 'border-admin-border text-admin-text-secondary',
            )}
          >
            <Sun size={16} /> Light
          </button>
          <button
            onClick={() => selectTheme('dark')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors duration-200',
              theme === 'dark' ? 'border-admin-orange bg-admin-orange/10 text-admin-orange' : 'border-admin-border text-admin-text-secondary',
            )}
          >
            <Moon size={16} /> Dark
          </button>
        </div>
        <p className="mt-2 text-xs text-admin-text-secondary">Applies immediately across the whole Staff Portal, and is remembered the next time you log in.</p>
      </div>

      <div className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe size={17} className="text-admin-orange" />
          <h2 className="font-semibold text-admin-text">Language</h2>
        </div>
        <select className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-admin-text-secondary">Your preference is saved — the interface currently displays in English only, more languages are coming soon.</p>
      </div>

      <div className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Bell size={17} className="text-admin-orange" />
          <h2 className="font-semibold text-admin-text">Notifications</h2>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-admin-text">Notify me when Admin approves or rejects my products</span>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => setNotificationsEnabled((v) => !v)}
            className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200', notificationsEnabled ? 'bg-admin-orange' : 'bg-admin-border')}
          >
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200', notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </label>
      </div>

      <Button variant="accent" onClick={() => savePreferences.mutate({ language, notifications_enabled: notificationsEnabled })} isLoading={savePreferences.isPending}>
        Save Preferences
      </Button>
    </div>
  );
}
