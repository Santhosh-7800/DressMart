import { Zap } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  endsAt: string | null | undefined;
  onExpire?: () => void;
  size?: 'sm' | 'lg';
  className?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function CountdownTimer({ endsAt, onExpire, size = 'sm', className }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(endsAt, onExpire);

  if (!endsAt || isExpired) return null;

  if (size === 'lg') {
    const segments = [
      ...(days > 0 ? [{ label: 'Days', value: days }] : []),
      { label: 'Hrs', value: hours },
      { label: 'Min', value: minutes },
      { label: 'Sec', value: seconds },
    ];

    return (
      <div className={cn('flex items-center gap-2', className)}>
        {segments.map((segment, idx) => (
          <div key={segment.label} className="flex items-center gap-2">
            <div className="flex min-w-[2.75rem] flex-col items-center rounded-lg bg-primary-900 px-2.5 py-1.5 text-white dark:bg-primary-800">
              <span className="text-lg font-bold leading-none tabular-nums">{pad(segment.value)}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wide text-primary-300">{segment.label}</span>
            </div>
            {idx < segments.length - 1 && <span className="text-lg font-bold text-primary-300">:</span>}
          </div>
        ))}
      </div>
    );
  }

  const label = days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold text-red-500', className)}>
      <Zap size={12} className="fill-red-500" /> {label}
    </span>
  );
}
