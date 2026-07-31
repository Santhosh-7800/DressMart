import { useState } from 'react';
import { Download, Bell } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useLocalStorage } from '@/hooks/useLocalStorage';

/**
 * A two-step, self-dismissing prompt: first offers to install the PWA, then — right after a
 * successful install, while the shopper is already in an "opting into this app" mindset — offers
 * to turn on push notifications too (skipped if they're already granted/denied, or the browser
 * doesn't support the install prompt at all). Dismissing the install step is remembered so it
 * doesn't nag on every visit to Profile; the push step always re-offers on a fresh page load if
 * still 'default', same as the manual toggle on the Settings page.
 */
export function InstallAppBanner() {
  const { isInstallable, promptInstall } = useInstallPrompt();
  const { permission, enablePush, isRegistering } = useFcmToken();
  const [installDismissed, setInstallDismissed] = useLocalStorage('dressmart:install-banner-dismissed', false);
  const [stage, setStage] = useState<'install' | 'push' | 'done'>('install');

  const handleInstall = async () => {
    const accepted = await promptInstall();
    setStage(accepted && permission === 'default' ? 'push' : 'done');
  };

  const handleDismissInstall = () => {
    setInstallDismissed(true);
    setStage('done');
  };

  if (stage === 'done') return null;
  if (stage === 'install' && (!isInstallable || installDismissed)) return null;
  if (stage === 'push' && permission !== 'default') return null;

  return (
    <Card hover={false} className="border-acc-primary/30 bg-acc-primary/5">
      {stage === 'install' ? (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acc-primary/10 text-acc-primary">
            <Download size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-acc-text dark:text-white">Install DressMart</p>
            <p className="text-xs text-acc-text-secondary">Add it to your home screen for a faster, full-screen shopping experience.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="account" onClick={handleInstall}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissInstall}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acc-primary/10 text-acc-primary">
            <Bell size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-acc-text dark:text-white">Stay in the loop</p>
            <p className="text-xs text-acc-text-secondary">Turn on notifications for order updates and offers.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="account" onClick={enablePush} isLoading={isRegistering}>
                Enable
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStage('done')}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
