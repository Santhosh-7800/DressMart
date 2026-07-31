import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { User, Store, Mail, Phone, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { db, functions } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';

const schema = z
  .object({
    ownerName: z.string().min(2, 'Enter the owner name'),
    storeName: z.string().min(2, 'Enter a store name'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * One-time, first-run flow — creates the single Head Seller account. Real enforcement of "only
 * once" is server-side (see createHeadSeller.ts's transaction on system/setup); the check here is
 * just a fast, friendly redirect so nobody sees this form after the fact.
 */
export function HeadSellerSetupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'system', 'setup'))
      .then((snap) => {
        if (snap.exists() && snap.data()?.head_seller_created) {
          navigate('/seller/login', { replace: true });
          return;
        }
        setIsChecking(false);
      })
      .catch(() => setIsChecking(false));
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const createHeadSeller = httpsCallable<
        { ownerName: string; storeName: string; email: string; phone: string; password: string },
        { success: true; uid: string }
      >(functions, 'createHeadSeller');
      await createHeadSeller({
        ownerName: values.ownerName,
        storeName: values.storeName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
      await signIn(values.email, values.password);
      navigate('/seller/dashboard', { replace: true });
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Could not create the Head Seller account'));
    }
  };

  if (isChecking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-300" size={32} />
      </div>
    );
  }

  return (
    <div>
      <Seo title="Create Head Seller" />
      <h1 className="text-2xl font-bold">Create Head Seller</h1>
      <p className="mt-1 text-sm text-primary-400">Set up the one Head Seller account for this DressMart store — this only appears once.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input label="Owner Name" placeholder="Jane Doe" leftIcon={<User size={16} />} error={errors.ownerName?.message} {...register('ownerName')} />
        <Input label="Store Name" placeholder="DressMart HQ" leftIcon={<Store size={16} />} error={errors.storeName?.message} {...register('storeName')} />
        <Input label="Email Address" type="email" placeholder="owner@example.com" leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
        <Input label="Phone Number" placeholder="9876543210" leftIcon={<Phone size={16} />} error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" placeholder="••••••••" leftIcon={<Lock size={16} />} error={errors.password?.message} {...register('password')} />
        <Input label="Confirm Password" type="password" placeholder="••••••••" leftIcon={<Lock size={16} />} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
          Create Head Seller
        </Button>
      </form>
    </div>
  );
}
