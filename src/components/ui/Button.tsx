import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRipple } from '@/hooks/useRipple';
import { RippleLayer } from './RippleLayer';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'account';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]',
  /** Orange primary button for the customer account section. */
  account: 'btn-account',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, disabled, children, onClick, ...props }, ref) => {
    const { ripples, addRipple, clearRipple } = useRipple();

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !isLoading) addRipple(e);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn('relative overflow-hidden', variantClasses[variant], sizeClasses[size], fullWidth && 'w-full', className)}
        disabled={disabled || isLoading}
        onClick={handleClick}
        {...props}
      >
        <RippleLayer ripples={ripples} onDone={clearRipple} />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
