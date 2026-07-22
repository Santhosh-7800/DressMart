import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, KeyRound } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/authService';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(emailFromState);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await authService.resetPassword(email, password);
      toast.success('Password reset successfully. Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reset failed');
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
        <Input label="Email Address" type="email" leftIcon={<KeyRound size={16} />} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="New Password" type="password" leftIcon={<Lock size={16} />} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Confirm New Password" type="password" leftIcon={<Lock size={16} />} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Reset Password
        </Button>
      </form>
    </div>
  );
}
