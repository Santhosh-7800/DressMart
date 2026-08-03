import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { staffService } from '@/services/staffService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { isStaffRole } from '@/lib/roles';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

/** Mirrors SellerLoginPage's password flow (staff accounts are created email/password-only via
 *  the Head Seller's Add Staff form — no phone/Google sign-in path for staff). */
export function StaffLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [rememberMe, setRememberMe] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const profile = await signIn(values.email, values.password, rememberMe);
      if (!profile || !isStaffRole(profile.role)) {
        await authService.signOut();
        toast.error('This account is not registered as Staff.');
        return;
      }
      if (profile.seller_id) {
        void staffService.logActivity({
          sellerId: profile.seller_id,
          staffId: profile.id,
          staffName: profile.full_name,
          action: 'login',
          targetType: 'session',
        });
      }
      navigate('/staff/dashboard', { replace: true });
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Login failed'));
    }
  };

  return (
    <div>
      <Seo title="Staff Login" />
      <h1 className="text-2xl font-bold">Staff Login</h1>
      <p className="mt-1 text-sm text-primary-400">Sign in to your DressMart staff account</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input label="Email Address" type="email" placeholder="you@example.com" leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" placeholder="••••••••" leftIcon={<Lock size={16} />} error={errors.password?.message} {...register('password')} />
        <label className="flex items-center gap-2 text-sm text-primary-500 dark:text-primary-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-primary-300 text-accent focus:ring-accent"
          />
          Remember me
        </label>
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Login
        </Button>
      </form>
    </div>
  );
}
