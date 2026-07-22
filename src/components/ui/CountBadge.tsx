import { AnimatePresence, motion } from 'framer-motion';

interface CountBadgeProps {
  count: number;
}

/** Small pill badge that pops with a spring whenever `count` changes — used for the cart item count. */
export function CountBadge({ count }: CountBadgeProps) {
  if (count <= 0) return null;

  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={count}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-900"
      >
        {count}
      </motion.span>
    </AnimatePresence>
  );
}
