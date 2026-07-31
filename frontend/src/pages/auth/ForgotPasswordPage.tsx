import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/authService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [isSent, setIsSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await authService.requestPasswordReset(values.email);
      setSubmittedEmail(values.email);
      setIsSent(true);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  if (isSent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <MailCheck size={28} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-primary-400">We've sent password reset instructions to {submittedEmail}.</p>
        <Button variant="outline" fullWidth className="mt-6" onClick={() => navigate('/reset-password', { state: { email: submittedEmail } })}>
          I have a reset code
        </Button>
        <Link to="/login" className="mt-4 flex items-center justify-center gap-1 text-sm text-accent-600 hover:underline">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Seo title="Forgot Password" />
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-primary-400">Enter your email and we'll send you instructions to reset it.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input label="Email Address" type="email" placeholder="you@example.com" leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Send Reset Instructions
        </Button>
      </form>

      <Link to="/login" className="mt-6 flex items-center justify-center gap-1 text-sm text-accent-600 hover:underline">
        <ArrowLeft size={14} /> Back to login
      </Link>
    </div>
  );
}
