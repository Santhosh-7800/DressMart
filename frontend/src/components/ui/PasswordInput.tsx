import { forwardRef, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'rightIcon'>;

/** Input with a show/hide toggle. `onMouseDown` on the toggle is prevented so clicking it never
 *  steals focus from the field, which would otherwise reset the cursor position. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      ref={ref}
      type={visible ? 'text' : 'password'}
      rightIcon={
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="cursor-pointer text-primary-400 transition-colors hover:text-primary-600 dark:hover:text-primary-200"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
});

PasswordInput.displayName = 'PasswordInput';
