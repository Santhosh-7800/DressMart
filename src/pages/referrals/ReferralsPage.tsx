import { useState } from 'react';
import { Users, Copy, Check, Share2, Gift, Clock, CheckCircle2, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useReferralHistory } from '@/hooks/useReferrals';
import { formatDate } from '@/lib/utils';
import type { ReferralStatus } from '@/types';

const STATUS_META: Record<ReferralStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Signed up', icon: Clock, className: 'bg-primary-100 text-primary-600 dark:bg-primary-700 dark:text-primary-200' },
  completed: { label: 'Order placed', icon: CheckCircle2, className: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300' },
  rewarded: { label: 'Reward earned', icon: PartyPopper, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export function ReferralsPage() {
  const { user } = useAuth();
  const { data: history, isLoading } = useReferralHistory();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const referralCode = user?.referral_code ?? '';
  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/signup?ref=${referralCode}` : '';

  const totalReferred = (history ?? []).length;
  const rewardsEarned = (history ?? []).filter((r) => r.status === 'rewarded').length;

  const handleCopy = async (value: string, kind: 'code' | 'link') => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    toast.success(kind === 'code' ? 'Referral code copied' : 'Referral link copied');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = async () => {
    const shareData = { title: 'Join DressMart', text: `Sign up on DressMart with my code ${referralCode} and we both get a reward!`, url: referralLink };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied to clipboard');
    }
  };

  return (
    <div>
      <Seo title="Refer a Friend" description="Share your DressMart referral code, track your referrals, and earn reward coupons." />
      <div className="mb-6 flex items-center gap-2">
        <Users size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Refer a Friend</h1>
      </div>

      <div className="mb-6 rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
        <p className="text-xs uppercase tracking-wide text-white/90">Your Referral Code</p>

        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-2xl font-bold tracking-widest text-acc-text sm:text-3xl">{referralCode}</p>
          <div className="flex gap-2">
            <Button variant="account" size="sm" onClick={() => handleCopy(referralCode, 'code')}>
              {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </Button>
            <Button variant="account" size="sm" onClick={handleShare}>
              <Share2 size={14} /> Share
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-2">
          <p className="min-w-0 flex-1 truncate pl-1.5 text-xs text-acc-text-secondary">{referralLink}</p>
          <button
            onClick={() => handleCopy(referralLink, 'link')}
            className="shrink-0 rounded-md bg-acc-primary p-1.5 text-white hover:bg-acc-primary-dark"
            aria-label="Copy referral link"
          >
            {copied === 'link' ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
          <p className="text-xs uppercase tracking-wide text-white/90">Friends Referred</p>
          <p className="mt-1 text-3xl font-bold text-white">{totalReferred}</p>
        </div>
        <div className="rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
          <p className="text-xs uppercase tracking-wide text-white/90">Rewards Earned</p>
          <p className="mt-1 text-3xl font-bold text-white">{rewardsEarned}</p>
        </div>
        <div className="rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
          <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/90">
            <Gift size={13} className="text-white" /> How it works
          </p>
          <p className="text-sm text-white/90">
            Your friend gets ₹150 off their first order. Once they order, you get a ₹200 off coupon — check your{' '}
            <a href="/coupons" className="font-semibold text-white underline hover:text-white/80">
              Coupons
            </a>{' '}
            page.
          </p>
        </div>
      </div>

      <h2 className="mb-3 font-semibold">Referral History</h2>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && (history ?? []).length === 0 && (
        <EmptyState icon={Users} title="No referrals yet" description="Share your code with friends — once they sign up, they'll show up here." />
      )}

      {!isLoading && (history ?? []).length > 0 && (
        <div className="card-surface divide-y divide-primary-100 dark:divide-primary-700">
          {(history ?? []).map((record) => {
            const meta = STATUS_META[record.status];
            const StatusIcon = meta.icon;
            return (
              <div key={record.id} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-700 dark:text-primary-200">
                  {record.referred_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{record.referred_name}</p>
                  <p className="truncate text-xs text-primary-400">{record.referred_email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                    <StatusIcon size={12} /> {meta.label}
                  </span>
                  <p className="text-xs text-primary-400">{formatDate(record.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
