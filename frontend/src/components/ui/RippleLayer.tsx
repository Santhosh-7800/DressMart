import { AnimatePresence, motion } from 'framer-motion';
import type { RippleItem } from '@/hooks/useRipple';

interface RippleLayerProps {
  ripples: RippleItem[];
  onDone: (id: number) => void;
}

/** Renders the expanding-circle overlays produced by useRipple — the parent must be
 *  `position: relative` (or similar) and `overflow-hidden` for these to clip correctly. */
export function RippleLayer({ ripples, onDone }: RippleLayerProps) {
  return (
    <AnimatePresence>
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ opacity: 0.35, scale: 0 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          onAnimationComplete={() => onDone(ripple.id)}
          className="pointer-events-none absolute rounded-full bg-current"
          style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
        />
      ))}
    </AnimatePresence>
  );
}
