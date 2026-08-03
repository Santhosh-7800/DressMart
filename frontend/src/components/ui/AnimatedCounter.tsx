import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  /** Formats the animated (rounded) value for display — e.g. formatCurrency, or a plain integer. */
  formatter?: (n: number) => string;
  className?: string;
}

/** Counts up from 0 to `value` once it scrolls into view, and re-animates from its current value
 *  whenever `value` changes (e.g. a realtime stat ticking up) — spring-based via framer-motion
 *  (already a project dependency), not a hand-rolled setInterval. */
export function AnimatedCounter({ value, formatter = (n) => String(Math.round(n)), className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (isInView) motionValue.set(value);
  }, [isInView, value, motionValue]);

  // Rounded to 1 decimal, not a whole integer — a plain-integer stat's formatter can round further
  // itself, but a rating like 4.5 must not collapse to 5 mid-format.
  useEffect(() => {
    return spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = formatter(Math.round(latest * 10) / 10);
    });
  }, [spring, formatter]);

  return (
    <span ref={ref} className={className}>
      {formatter(0)}
    </span>
  );
}
