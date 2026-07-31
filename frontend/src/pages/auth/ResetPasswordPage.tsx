import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/authService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      toast.error('This reset link is invalid or has expired. Please request a new one.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.confirmPasswordReset(oobCode, password);
      toast.success('Password reset successfully. Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Reset failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Seo title="Reset Password" />
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <p className="mt-1 text-sm text-primary-400">Choose a strong password you haven't used before.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input label="New Password" type="password" leftIcon={<Lock size={16} />} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Confirm New Password" type="password" leftIcon={<Lock size={16} />} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Reset Password
        </Button>
      </form>
    </div>
  );
}
