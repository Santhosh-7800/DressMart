import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Material-style floating label that animates up into the border on focus/fill, instead of a static label above the field. Opt-in — existing forms are unaffected. */
  floating?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, floating, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    if (floating && label) {
      return (
        <div className="w-full">
          <div className="relative">
            {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-400">{leftIcon}</span>}
            <input
              ref={ref}
              id={inputId}
              placeholder=" "
              className={cn(
                'peer input-field pb-2 pt-6 focus:border-acc-primary focus:ring-4 focus:ring-acc-primary/10',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500/10',
                className,
              )}
              aria-invalid={Boolean(error)}
              {...props}
            />
            <label
              htmlFor={inputId}
              className={cn(
                'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-primary-400 transition-all duration-150 peer-focus:top-3.5 peer-focus:text-[11px] peer-focus:text-acc-primary peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-[11px]',
                leftIcon && 'left-10',
              )}
            >
              {label}
            </label>
            {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400">{rightIcon}</span>}
          </div>
          {error && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
          {!error && hint && <p className="mt-1.5 text-xs text-primary-400">{hint}</p>}
        </div>
      );
    }

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-400">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn('input-field', leftIcon && 'pl-10', rightIcon && 'pr-10', error && 'border-red-500 focus:border-red-500', className)}
            aria-invalid={Boolean(error)}
            {...props}
          />
          {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400">{rightIcon}</span>}
        </div>
        {error && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
        {!error && hint && <p className="mt-1.5 text-xs text-primary-400">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
