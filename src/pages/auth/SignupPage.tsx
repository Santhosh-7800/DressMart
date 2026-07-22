import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, Phone, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

const schema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCodeFromUrl = searchParams.get('ref') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { referralCode: referralCodeFromUrl } });

  const onSubmit = async (values: FormValues) => {
    try {
      await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone,
        referralCode: values.referralCode?.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign up failed');
    }
  };

  return (
    <div>
      <Seo title="Sign Up" />
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-primary-400">Join DressMart for a premium shopping experience</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input label="Full Name" placeholder="John Doe" leftIcon={<User size={16} />} error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Email Address" type="email" placeholder="you@example.com" leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
        <Input label="Phone Number" placeholder="9876543210" leftIcon={<Phone size={16} />} error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" placeholder="••••••••" leftIcon={<Lock size={16} />} error={errors.password?.message} {...register('password')} />
        <Input label="Confirm Password" type="password" placeholder="••••••••" leftIcon={<Lock size={16} />} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Input
          label="Referral Code (optional)"
          placeholder="e.g. JOHN4F2A"
          leftIcon={<Gift size={16} />}
          error={errors.referralCode?.message}
          {...register('referralCode')}
        />
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-primary-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent-600 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
