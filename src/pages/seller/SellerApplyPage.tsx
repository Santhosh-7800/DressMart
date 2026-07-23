import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Store, CheckCircle2, Loader2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { isSellerRole } from '@/lib/roles';
import type { SellerApplicationInput } from '@/types';

type FormState = Omit<SellerApplicationInput, 'email'>;

const EMPTY_FORM: FormState = { full_name: '', phone: '', store_name: '', gst_number: '' };

/** Buyer-only "apply to become a seller" form — role/`/sell` route is public to signed-in buyers,
 *  existing sellers/head-sellers are redirected straight to their dashboard. */
export function SellerApplyPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY_FORM, full_name: user?.full_name ?? '', phone: user?.phone ?? '' }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (isAuthLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-300" size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: '/sell' }} replace />;

  if (isSellerRole(user.role)) return <Navigate to="/seller/dashboard" replace />;

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.phone.trim() || !form.store_name.trim() || !form.gst_number.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.applyToBecomeSeller(user.id, {
        full_name: form.full_name.trim(),
        email: user.email,
        phone: form.phone.trim(),
        store_name: form.store_name.trim(),
        gst_number: form.gst_number.trim().toUpperCase(),
      });
      setIsSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit your application');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="container-app flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-12 text-center">
        <Seo title="Application Submitted" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-acc-text dark:text-white">Application submitted</h1>
          <p className="mt-2 text-sm text-acc-text-secondary">
            Thanks, {form.full_name.split(' ')[0]}! Your application for <span className="font-semibold">{form.store_name}</span> is now pending review by
            our Head Seller team. We'll notify you here and by email as soon as a decision is made — usually within 1–2 business days.
          </p>
          <Button variant="account" className="mt-6" onClick={() => navigate('/profile')}>
            Back to My Account
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container-app max-w-lg py-10">
      <Seo title="Become a Seller" description="Apply to start selling on DressMart." />
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-acc-primary/10">
          <Store size={26} className="text-acc-primary" />
        </div>
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Become a Seller</h1>
        <p className="mt-1.5 text-sm text-acc-text-secondary">Tell us a bit about your store — you can start listing products once the Head Seller approves your application.</p>
      </div>

      <Card>
        <div className="space-y-4">
          <Input
            floating
            label="Your Full Name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
          <Input floating label="Phone Number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input floating label="Store Name" value={form.store_name} onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))} />
          <Input
            floating
            label="GST Number"
            value={form.gst_number}
            onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value.toUpperCase() }))}
            hint="15-character GSTIN, e.g. 22AAAAA0000A1Z5"
          />
          <Button variant="account" fullWidth onClick={handleSubmit} isLoading={isSubmitting}>
            Submit Application
          </Button>
        </div>
      </Card>
    </div>
  );
}
