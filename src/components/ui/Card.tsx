import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLMotionProps<'div'> {
  /** Frosted, translucent treatment — only appropriate over a colored/gradient backdrop, not the plain page background. */
  glass?: boolean;
  /** Lifts slightly with a deeper shadow on hover. Defaults on — set false for static/non-interactive cards. */
  hover?: boolean;
}

/**
 * Reusable premium card: rounded 20px, soft shadow, fade/slide-up entrance, and a subtle hover
 * lift — used across the customer account dashboard so every section shares one visual language.
 */
export function Card({ className, glass, hover = true, children, ...props }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      whileHover={hover ? { y: -3 } : undefined}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'rounded-[20px] border p-5 transition-shadow duration-300',
        glass
          ? 'border-white/40 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-card-dark/60'
          : 'border-acc-border bg-white shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark',
        hover && 'hover:shadow-[0_16px_32px_rgba(17,24,39,0.10)]',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
