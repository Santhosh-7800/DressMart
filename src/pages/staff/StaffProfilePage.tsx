import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { staffService } from '@/services/staffService';
import { authService } from '@/services/authService';
import { uploadAvatarImage, isAcceptedImageFile } from '@/services/storageService';
import { formatDate, cn } from '@/lib/utils';

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-admin-text">{label}</span>
      <div className="input-field flex items-center bg-admin-bg text-admin-text-secondary">{value || '—'}</div>
    </div>
  );
}

function passwordStrength(password: string): { score: number; label: string; barColor: string } {
  const criteria = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = criteria.filter(Boolean).length;
  if (password.length === 0) return { score: 0, label: '', barColor: 'bg-admin-border' };
  if (score <= 2) return { score, label: 'Weak', barColor: 'bg-red-500' };
  if (score === 3) return { score, label: 'Fair', barColor: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Good', barColor: 'bg-blue-500' };
  return { score, label: 'Strong', barColor: 'bg-emerald-500' };
}

function PasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-admin-text">{label}</span>
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rightIcon={
          <button type="button" onClick={() => setVisible((v) => !v)} className="pointer-events-auto text-admin-text-secondary hover:text-admin-text" tabIndex={-1}>
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
    </label>
  );
}

export function StaffProfilePage() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { data: details, isLoading } = useQuery({ queryKey: ['staff', 'details', user?.id], queryFn: () => staffService.getDetails(user!.id), enabled: Boolean(user?.id) });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone ?? '');
    }
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      // Only full_name/phone are ever written here — employee_id/department/shop_name/status/role
      // have no corresponding field in this mutation, which is what actually prevents a staff
      // member from changing them (not just the read-only styling below).
      await authService.updateProfile(user!.id, { full_name: fullName });
      await staffService.saveDetails(user!.id, { phone });
    },
    onSuccess: async () => {
      // Reactively updates the sidebar greeting (StaffLayout) and dashboard welcome message
      // (StaffDashboardPage), both of which read full_name straight from useAuth().user.
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['staff', 'details', user?.id] });
      toast.success('Profile updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    if (!isAcceptedImageFile(file)) {
      toast.error('Only JPG, PNG, or WEBP images are supported');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const url = await uploadAvatarImage(file, user.id);
      await authService.updateProfile(user.id, { avatar_url: url });
      await refreshProfile();
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Photo upload failed');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const strength = passwordStrength(newPassword);
  const changePassword = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error('Enter your current password.');
      if (strength.score < 5) throw new Error('New password must be 8+ characters with uppercase, lowercase, a number, and a special character.');
      if (newPassword !== confirmPassword) throw new Error('New password and confirmation do not match.');
      await authService.changeOwnPassword(user!.email, currentPassword, newPassword);
    },
    onSuccess: () => {
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Seo title="Staff — My Profile" />
      <div className="mb-1 flex items-center gap-2">
        <User size={22} className="text-admin-orange" />
        <h1 className="text-2xl font-bold text-admin-text">My Profile</h1>
      </div>

      <div className="card-surface space-y-5 p-5">
        <div className="flex items-center gap-4">
          <div className="group relative h-20 w-20 shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-admin-orange-light to-admin-orange text-2xl font-bold text-white shadow-sm">
              {user.avatar_url ? <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" /> : fullName.charAt(0).toUpperCase()}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100"
              title="Change photo"
            >
              <Camera size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
                e.target.value = '';
              }}
            />
          </div>
          <div>
            <p className="font-semibold text-admin-text">{user.full_name}</p>
            <p className="text-sm text-admin-text-secondary">{isUploadingPhoto ? 'Uploading photo…' : 'Click the photo to change it'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-admin-text">Full Name</span>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-admin-text">Phone Number</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

          <ReadOnlyField label="Employee ID" value={details?.employee_id ?? ''} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-admin-text">Email</span>
            <div className="input-field flex items-center bg-admin-bg text-admin-text-secondary">{user.email}</div>
            <p className="mt-1 text-xs text-admin-text-secondary">Contact Admin to change your email.</p>
          </div>
          <ReadOnlyField label="Department" value={details?.department ?? ''} />
          <ReadOnlyField label="Shop Name" value={details?.shop_name ?? ''} />
          <ReadOnlyField label="Joining Date" value={details ? formatDate(details.created_at) : ''} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-admin-text">Status</span>
            <div className="input-field flex items-center bg-admin-bg">
              <span className={details?.status === 'inactive' ? 'badge-danger' : 'badge-success'}>{details?.status === 'inactive' ? 'Inactive' : 'Active'}</span>
            </div>
          </div>
        </div>

        <Button variant="accent" onClick={() => saveProfile.mutate()} isLoading={saveProfile.isPending}>
          Save Changes
        </Button>
      </div>

      <div className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={17} className="text-admin-orange" />
          <h2 className="font-semibold text-admin-text">Change Password</h2>
        </div>
        <div className="space-y-4">
          <PasswordInput label="Current Password" value={currentPassword} onChange={setCurrentPassword} />
          <div>
            <PasswordInput label="New Password" value={newPassword} onChange={setNewPassword} />
            {newPassword.length > 0 && (
              <div className="mt-1.5">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-200', i < strength.score ? strength.barColor : 'bg-admin-border')} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-admin-text-secondary">{strength.label} — 8+ characters, uppercase, lowercase, number, and special character</p>
              </div>
            )}
          </div>
          <PasswordInput label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} />
          <Button variant="accent" onClick={() => changePassword.mutate()} isLoading={changePassword.isPending}>
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
