import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { authService, type ConfirmationResult } from '@/services/authService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { isSellerRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const RECAPTCHA_CONTAINER_ID = 'seller-login-recaptcha-container';

export function SellerLoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'password' | 'phone'>('password');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  /** Only sellers/head-sellers may use this page — a buyer account is signed back out and sent to
   *  the buyer login instead. */
  const routeAfterLogin = async (profile: Profile | null | undefined) => {
    if (!profile || !isSellerRole(profile.role)) {
      await authService.signOut();
      toast.error('This account is registered as a Buyer. Please use the Buyer Login.');
      navigate('/login', { replace: true });
      return;
    }
    navigate('/seller/dashboard', { replace: true });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const profile = await signIn(values.email, values.password);
      await routeAfterLogin(profile);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Login failed'));
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const profile = await signInWithGoogle();
      await routeAfterLogin(profile);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Google login failed'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div>
      <Seo title="Seller Login" />
      <h1 className="text-2xl font-bold">Seller Login</h1>
      <p className="mt-1 text-sm text-primary-400">Sign in to manage your DressMart store</p>

      <div className="mt-5 flex gap-2 rounded-xl bg-primary-50 p-1 dark:bg-primary-800">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors', mode === 'password' ? 'bg-white shadow-sm dark:bg-primary-700' : 'text-primary-400')}
        >
          Email / Google
        </button>
        <button
          type="button"
          onClick={() => setMode('phone')}
          className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors', mode === 'phone' ? 'bg-white shadow-sm dark:bg-primary-700' : 'text-primary-400')}
        >
          Phone OTP
        </button>
      </div>

      {mode === 'password' ? (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input label="Email Address" type="email" placeholder="you@example.com" leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" placeholder="••••••••" leftIcon={<Lock size={16} />} error={errors.password?.message} {...register('password')} />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-accent-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
              Login
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-primary-100 dark:bg-primary-700" />
            <span className="text-xs text-primary-400">OR</span>
            <div className="h-px flex-1 bg-primary-100 dark:bg-primary-700" />
          </div>

          <Button variant="outline" fullWidth onClick={handleGoogle} isLoading={isGoogleLoading}>
            {!isGoogleLoading && (
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </Button>
        </>
      ) : (
        <SellerPhoneLogin onSuccess={routeAfterLogin} />
      )}
    </div>
  );
}

function SellerPhoneLogin({ onSuccess }: { onSuccess: (profile: Profile | null | undefined) => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    setIsSending(true);
    try {
      confirmationRef.current = await authService.sendPhoneOtp(`+91${phone}`, RECAPTCHA_CONTAINER_ID);
      setIsOtpSent(true);
      setCountdown(RESEND_SECONDS);
      toast.success('OTP sent to your phone');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Could not send OTP'));
    } finally {
      setIsSending(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) {
      toast.error('Enter the complete 6-digit code');
      return;
    }
    if (!confirmationRef.current) {
      toast.error('Please request a new OTP');
      return;
    }
    setIsSubmitting(true);
    try {
      const profile = await authService.confirmPhoneOtp(confirmationRef.current, code);
      await onSuccess(profile);
    } catch {
      toast.error('Invalid or expired OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6">
      <div id={RECAPTCHA_CONTAINER_ID} />

      {!isOtpSent ? (
        <div className="space-y-4">
          <Input label="Phone Number" placeholder="9876543210" leftIcon={<Phone size={16} />} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="accent" fullWidth size="lg" onClick={sendOtp} isLoading={isSending}>
            Send OTP
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-primary-400">Enter the 6-digit code sent to {phone}</p>
          <div className="flex justify-between gap-2">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                maxLength={1}
                inputMode="numeric"
                className="h-14 w-12 rounded-xl border border-primary-200 text-center text-xl font-semibold focus:border-accent dark:border-primary-600 dark:bg-primary-800"
              />
            ))}
          </div>

          <Button variant="accent" fullWidth size="lg" className="mt-6" onClick={handleVerify} isLoading={isSubmitting}>
            Verify &amp; Login
          </Button>

          <button
            onClick={sendOtp}
            disabled={countdown > 0 || isSending}
            className="mt-4 w-full text-center text-sm text-accent-600 hover:underline disabled:cursor-not-allowed disabled:text-primary-300"
          >
            {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
          </button>
        </div>
      )}
    </div>
  );
}
