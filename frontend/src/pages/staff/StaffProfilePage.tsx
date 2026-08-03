import { useState } from 'react';
import toast from 'react-hot-toast';
import { Moon, Sun, Monitor, Lock, User } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAvatar } from '@/hooks/useAvatar';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

/** A staff account's own profile — deliberately scoped to identity/appearance/password only.
 *  No Danger Zone (account deletion is Head-Seller-only, via removeStaff) and no push-notification
 *  opt-in (out of scope for the product-management-only Staff role). */
export function StaffProfilePage() {
  const { user } = useAuth();
  const { avatarUrl, uploadAvatar, isUploading } = useAvatar();
  const { themePreference, setThemePreference } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  if (!user) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadAvatar(file);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update photo');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
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
      await authService.changeOwnPassword(currentPassword, newPassword);
      toast.success('Password updated');
      setCurrentPassword('');
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
      <Seo title="Profile" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Profile</h1>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <User size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Your Profile</h2>
        </div>
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer">
            <Avatar src={avatarUrl} name={user.full_name} size="xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[11px] font-medium text-white opacity-0 transition-opacity hover:opacity-100">
              {isUploading ? '…' : 'Change'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} disabled={isUploading} />
          </label>
          <div>
            <p className="text-base font-semibold text-acc-text dark:text-white">{user.full_name}</p>
            <p className="text-sm text-acc-text-secondary">{user.email}</p>
            <p className="text-xs text-acc-text-secondary">{user.store_name ? `Staff · ${user.store_name}` : 'Staff'}</p>
          </div>
        </div>
      </Card>

      <Card hover={false}>
        <h2 className="mb-4 text-base font-bold text-acc-text dark:text-white">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setThemePreference('light')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
              themePreference === 'light' ? 'border-acc-primary bg-acc-primary/10 text-acc-primary' : 'border-acc-border text-acc-text-secondary dark:border-primary-700',
            )}
          >
            <Sun size={16} /> Light
          </button>
          <button
            onClick={() => setThemePreference('dark')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
              themePreference === 'dark' ? 'border-acc-primary bg-acc-primary/10 text-acc-primary' : 'border-acc-border text-acc-text-secondary dark:border-primary-700',
            )}
          >
            <Moon size={16} /> Dark
          </button>
          <button
            onClick={() => setThemePreference('system')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
              themePreference === 'system' ? 'border-acc-primary bg-acc-primary/10 text-acc-primary' : 'border-acc-border text-acc-text-secondary dark:border-primary-700',
            )}
          >
            <Monitor size={16} /> System
          </button>
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Lock size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Change Password</h2>
        </div>
        <div className="space-y-4">
          <PasswordInput floating label="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <PasswordInput floating label="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordInput floating label="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Button variant="account" onClick={handleChangePassword} isLoading={isSavingPassword}>
            Update Password
          </Button>
        </div>
      </Card>
    </div>
  );
}
