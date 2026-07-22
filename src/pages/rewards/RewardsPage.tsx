import { Gift, TrendingUp, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRewardsWallet, useRewardsHistory } from '@/hooks/useRewards';
import { calculateRedemptionValue, REDEEM_POINTS_PER_RUPEE, EARN_RUPEES_PER_POINT } from '@/services/rewardsService';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export function RewardsPage() {
  const { data: wallet, isLoading: isLoadingWallet } = useRewardsWallet();
  const { data: history, isLoading: isLoadingHistory } = useRewardsHistory();

  const isLoading = isLoadingWallet || isLoadingHistory;
  const pointsBalance = wallet?.points_balance ?? 0;
  const lifetimeEarned = wallet?.lifetime_points_earned ?? 0;

  return (
    <div>
      <Seo title="Rewards" description="Track your DressMart reward points, redeem them at checkout, and view your rewards history." />
      <div className="mb-6 flex items-center gap-2">
        <Gift size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Rewards</h1>
      </div>

      {isLoadingWallet ? (
        <Skeleton className="mb-6 h-32 w-full" />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
            <p className="text-xs uppercase tracking-wide text-white/90">Points Balance</p>
            <p className="mt-1 text-3xl font-bold text-white">{pointsBalance.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-xs text-white/90">Worth {formatCurrency(calculateRedemptionValue(pointsBalance))}</p>
          </div>
          <div className="rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
            <p className="text-xs uppercase tracking-wide text-white/90">Lifetime Points Earned</p>
            <p className="mt-1 text-3xl font-bold text-white">{lifetimeEarned.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8">
            <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/90">
              <TrendingUp size={13} className="text-white" /> How it works
            </p>
            <p className="text-sm text-white/90">
              Earn 1 point per ₹{EARN_RUPEES_PER_POINT} spent. Redeem {REDEEM_POINTS_PER_RUPEE} points for ₹1 off at checkout.
            </p>
          </div>
        </div>
      )}

      <h2 className="mb-3 font-semibold">Rewards History</h2>

      {isLoadingHistory && <Skeleton className="h-40 w-full" />}

      {!isLoadingHistory && (history ?? []).length === 0 && (
        <EmptyState icon={Gift} title="No rewards activity yet" description="Points you earn from purchases and redeem at checkout will show up here." />
      )}

      {!isLoading && (history ?? []).length > 0 && (
        <div className="card-surface divide-y divide-primary-100 dark:divide-primary-700">
          {(history ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  entry.type === 'earned' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-primary-100 dark:bg-primary-700'
                }`}
              >
                {entry.type === 'earned' ? (
                  <ArrowUpCircle size={18} className="text-emerald-600" />
                ) : (
                  <ArrowDownCircle size={18} className="text-primary-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{entry.description}</p>
                <p className="text-xs text-primary-400">{formatDateTime(entry.created_at)}</p>
              </div>
              <p className={`shrink-0 font-semibold ${entry.type === 'earned' ? 'text-emerald-600' : 'text-primary-500'}`}>
                {entry.points > 0 ? '+' : ''}
                {entry.points.toLocaleString('en-IN')} pts
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
