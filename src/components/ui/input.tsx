import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[10px] border border-wa-border bg-wa-bg px-3 py-2',
        'text-sm text-wa-text font-normal',
        'placeholder:text-wa-text/50',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:border-wa-medium',
        'focus-visible:ring-[3px] focus-visible:ring-wa-medium/12',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'hover:border-wa-muted/40',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
