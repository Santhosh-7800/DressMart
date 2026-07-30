import { useCallback, useState, type MouseEvent } from 'react';

export interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

/** Material-style touch ripple, shared by Button and any raw tappable element (bottom-nav tabs,
 *  seller nav tabs) that wants the same tactile feedback without going through the Button
 *  component. Pair with <RippleLayer> for the actual rendering. */
export function useRipple() {
  const [ripples, setRipples] = useState<RippleItem[]>([]);

  const addRipple = useCallback((e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    setRipples((prev) => [...prev, { id: Date.now(), x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
  }, []);

  const clearRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { ripples, addRipple, clearRipple };
}
