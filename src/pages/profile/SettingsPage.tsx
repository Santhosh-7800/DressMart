import { useState } from 'react';
import toast from 'react-hot-toast';
import { Moon, Sun, Lock, AlertTriangle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (!user) return null;

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsSavingPassword(true);
    try {
      await authService.resetPassword(user.email, newPassword);
      toast.success('Password updated');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <Seo title="Settings" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Settings</h1>

      <Card hover={false}>
        <h2 className="mb-4 text-base font-bold text-acc-text dark:text-white">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
              theme === 'light' ? 'border-acc-primary bg-acc-primary/10 text-acc-primary' : 'border-acc-border text-acc-text-secondary dark:border-primary-700',
            )}
          >
            <Sun size={16} /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
              theme === 'dark' ? 'border-acc-primary bg-acc-primary/10 text-acc-primary' : 'border-acc-border text-acc-text-secondary dark:border-primary-700',
            )}
          >
            <Moon size={16} /> Dark
          </button>
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Lock size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Change Password</h2>
        </div>
        <div className="space-y-4">
          <Input floating label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input floating label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Button variant="account" onClick={handleChangePassword} isLoading={isSavingPassword}>
            Update Password
          </Button>
        </div>
      </Card>

      <Card hover={false} className="border-red-200 dark:border-red-900/40">
        <div className="mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle size={17} />
          <h2 className="text-base font-bold">Danger Zone</h2>
        </div>
        <p className="mb-4 text-sm text-acc-text-secondary">Permanently delete your DressMart account and all associated data.</p>
        <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
          Delete Account
        </Button>
      </Card>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete your account?">
        <p className="mb-4 text-sm text-primary-500">
          Account deletion requests are handled by our support team to make sure any pending orders or refunds are settled first. Submit a request and we'll follow up by email within 24 hours.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              toast.success('Deletion request received — our support team will contact you shortly.');
              setIsDeleteModalOpen(false);
            }}
          >
            Request Deletion
          </Button>
        </div>
      </Modal>
    </div>
  );
}
