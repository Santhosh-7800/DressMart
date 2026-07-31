import { useEffect, useState } from 'react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isExpired: boolean;
}

function computeParts(targetIso: string | null | undefined): CountdownParts {
  const rawMs = targetIso ? new Date(targetIso).getTime() - Date.now() : 0;
  const clampedMs = Math.max(0, rawMs);
  return {
    days: Math.floor(clampedMs / 86_400_000),
    hours: Math.floor((clampedMs % 86_400_000) / 3_600_000),
    minutes: Math.floor((clampedMs % 3_600_000) / 60_000),
    seconds: Math.floor((clampedMs % 60_000) / 1000),
    totalMs: clampedMs,
    isExpired: !targetIso || rawMs <= 0,
  };
}

/** Live-ticking countdown to `targetIso`. Fires `onExpire` once, the instant it crosses zero. */
export function useCountdown(targetIso: string | null | undefined, onExpire?: () => void): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() => computeParts(targetIso));

  useEffect(() => {
    setParts(computeParts(targetIso));
    if (!targetIso) return undefined;

    const interval = setInterval(() => {
      setParts((prev) => {
        const next = computeParts(targetIso);
        if (next.isExpired && !prev.isExpired) onExpire?.();
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  return parts;
}
