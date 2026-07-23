import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Phone } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService, type ConfirmationResult } from '@/services/authService';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

export function OtpVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const phoneFromState = (location.state as { phone?: string } | null)?.phone ?? '';

  const [phone, setPhone] = useState(phoneFromState);
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
      toast.error(error instanceof Error ? error.message : 'Could not send OTP');
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
      await authService.confirmPhoneOtp(confirmationRef.current, code);
      toast.success('Phone number verified!');
      navigate('/profile');
    } catch {
      toast.error('Invalid or expired OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Seo title="Verify OTP" />
      <h1 className="text-2xl font-bold">Verify your phone</h1>
      <p className="mt-1 text-sm text-primary-400">{isOtpSent ? `Enter the 6-digit code sent to ${phone}` : 'Enter your phone number to receive a verification code'}</p>

      {/* Invisible reCAPTCHA anchor required by Firebase phone auth — renders nothing visible. */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      {!isOtpSent ? (
        <div className="mt-6 space-y-4">
          <Input label="Phone Number" placeholder="9876543210" leftIcon={<Phone size={16} />} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="accent" fullWidth size="lg" onClick={sendOtp} isLoading={isSending}>
            Send OTP
          </Button>
        </div>
      ) : (
        <div className="mt-6">
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
            Verify &amp; Continue
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
