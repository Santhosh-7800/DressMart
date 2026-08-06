import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/authService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';

/** Redirect to /login after showing the success screen — long enough to actually read it, short
 *  enough not to feel stuck. */
const SUCCESS_REDIRECT_MS = 3000;

type PageState = 'verifying' | 'invalid' | 'ready' | 'success';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') ?? '';

  const [state, setState] = useState<PageState>('verifying');
  const [invalidMessage, setInvalidMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verifies the oobCode *before* showing the new-password form — catches an invalid, expired, or
  // already-used reset link immediately (see authService.verifyPasswordResetCode) instead of only
  // failing after the user has already typed a new password.
  useEffect(() => {
    if (!oobCode) {
      setInvalidMessage('This reset link is invalid or missing a code. Please request a new one.');
      setState('invalid');
      return;
    }
    authService
      .verifyPasswordResetCode(oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setState('ready');
      })
      .catch((error) => {
        setInvalidMessage(getFriendlyErrorMessage(error, 'This reset link is invalid or has expired.'));
        setState('invalid');
      });
  }, [oobCode]);

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
      await authService.confirmPasswordReset(oobCode, password);
      setState('success');
      setTimeout(() => navigate('/login'), SUCCESS_REDIRECT_MS);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Reset failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (state === 'verifying') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-300" size={32} />
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertCircle size={28} className="text-red-600" />
        </div>
        <h1 className="text-xl font-bold">Link no longer valid</h1>
        <p className="mt-2 text-sm text-primary-400">{invalidMessage}</p>
        <Button variant="outline" fullWidth className="mt-6" onClick={() => navigate('/forgot-password')}>
          Request a new link
        </Button>
        <Link to="/login" className="mt-4 block text-center text-sm text-accent-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold">Password reset successfully</h1>
        <p className="mt-2 text-sm text-primary-400">Redirecting you to login...</p>
      </div>
    );
  }

  return (
    <div>
      <Seo title="Reset Password" />
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <p className="mt-1 text-sm text-primary-400">
        {email ? <>for {email} — </> : null}Choose a strong password you haven't used before.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <PasswordInput
          label="New Password"
          leftIcon={<Lock size={16} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          required
        />
        <PasswordInput
          label="Confirm New Password"
          leftIcon={<Lock size={16} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
          required
        />
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Reset Password
        </Button>
      </form>
    </div>
  );
}
