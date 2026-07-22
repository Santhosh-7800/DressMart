import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { isBackendRole } from '@/lib/roles';
import { useForceLightMode } from '@/hooks/useForceLightMode';

/**
 * Dedicated login for the Admin Panel — mirrors StaffLoginPage's isolation model. Only
 * admin/shop_owner accounts are let through; a customer or staff account that successfully
 * authenticates here is signed back out immediately and shown an error, never left signed in
 * with the wrong session on the wrong portal.
 */
export function AdminLoginPage() {
  const { user, isLoading: isAuthLoading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  useForceLightMode();

  useEffect(() => {
    if (isAuthLoading || !user) return;
    if (isBackendRole(user.role)) navigate('/admin', { replace: true });
    else if (user.role === 'staff') navigate('/staff/dashboard', { replace: true });
    else navigate('/', { replace: true });
  }, [isAuthLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const profile = await signIn(email, password);
      if (!isBackendRole(profile.role)) {
        await signOut();
        toast.error('This login is for Admin accounts only.');
        return;
      }
      navigate('/admin', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg">
        <Loader2 className="animate-spin text-admin-orange" size={32} />
      </div>
    );
  }

  return (
    <div className="admin-panel flex min-h-screen bg-admin-bg">
      <Seo title="Admin Login" />
      <div className="hidden flex-1 flex-col justify-between bg-admin-navy p-12 text-white lg:flex">
        <Link to="/" className="text-2xl font-bold">
          Dress<span className="text-admin-orange">Mart</span>
        </Link>
        <div>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-admin-orange-light to-admin-orange shadow-[0_10px_25px_rgba(255,107,0,0.35)]">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-3xl font-bold leading-tight">
            Admin Panel
            <br />
            Full Store Control
          </h1>
          <p className="mt-4 max-w-sm text-white/60">Products, orders, customers, coupons, reports, and staff — all in one place.</p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} DressMart. All rights reserved.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-center text-2xl font-bold text-admin-text lg:hidden">
            Dress<span className="text-admin-orange">Mart</span>
          </Link>
          <div className="card-surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-admin-text">Admin Login</h2>
            <p className="mt-1 text-sm text-admin-text-secondary">Sign in with your administrator account.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input name="email" label="Email Address" type="email" placeholder="admin@dressmart.com" leftIcon={<Mail size={16} />} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input name="password" label="Password" type="password" placeholder="••••••••" leftIcon={<Lock size={16} />} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" variant="accent" fullWidth size="lg" isLoading={isSubmitting}>
                Login
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-admin-text-secondary">
              Not admin? <Link to="/login" className="font-medium text-admin-orange hover:underline">Customer login</Link> ·{' '}
              <Link to="/staff/login" className="font-medium text-admin-orange hover:underline">Staff login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
