import { Gift } from 'lucide-react';
import { calculateRedemptionValue, REDEEM_POINTS_PER_RUPEE } from '@/services/rewardsService';
import { formatCurrency, cn } from '@/lib/utils';

interface RewardsRedemptionCardProps {
  pointsBalance: number;
  maxRedeemablePoints: number;
  pointsToRedeem: number;
  onChange: (points: number) => void;
}

export function RewardsRedemptionCard({ pointsBalance, maxRedeemablePoints, pointsToRedeem, onChange }: RewardsRedemptionCardProps) {
  if (pointsBalance <= 0) return null;

  const redeemableCap = Math.min(pointsBalance, maxRedeemablePoints);
  const isUsingPoints = pointsToRedeem > 0;
  const discountValue = calculateRedemptionValue(pointsToRedeem);

  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gift size={18} className="text-accent" />
        <h3 className="font-semibold">Reward Points</h3>
        <span className="ml-auto text-sm text-primary-400">{pointsBalance.toLocaleString('en-IN')} pts available</span>
      </div>

      <label className={cn('flex items-center gap-3 rounded-xl border p-3 transition-colors', isUsingPoints ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}>
        <input
          type="checkbox"
          checked={isUsingPoints}
          onChange={(e) => onChange(e.target.checked ? redeemableCap : 0)}
          className="h-4 w-4 rounded border-primary-300 text-accent focus:ring-accent"
          disabled={redeemableCap <= 0}
        />
        <span className="text-sm">
          Use <strong>{redeemableCap.toLocaleString('en-IN')}</strong> points for <strong>{formatCurrency(calculateRedemptionValue(redeemableCap))}</strong> off
        </span>
      </label>

      {isUsingPoints && (
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={redeemableCap}
            step={REDEEM_POINTS_PER_RUPEE}
            value={pointsToRedeem}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="mt-1 flex justify-between text-xs text-primary-400">
            <span>{pointsToRedeem.toLocaleString('en-IN')} points</span>
            <span className="font-medium text-emerald-600">−{formatCurrency(discountValue)}</span>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-primary-400">Earn 1 point for every ₹10 you spend. Redeem {REDEEM_POINTS_PER_RUPEE} points for ₹1 off.</p>
    </div>
  );
}
