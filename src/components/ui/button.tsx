import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px]',
    'text-sm font-medium',
    'transition-all duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa-medium/40 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-wa-medium text-white font-semibold',
          'shadow-[0_2px_8px_rgba(124,58,237,0.2)]',
          'hover:bg-wa-medium hover:shadow-[0_6px_20px_rgba(124,58,237,0.25)]',
          'hover:-translate-y-px hover:scale-[1.02]',
        ].join(' '),
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: [
          'border border-wa-border bg-transparent text-wa-text',
          'hover:bg-wa-border/30 hover:border-wa-medium/30',
        ].join(' '),
        secondary: [
          'bg-[var(--color-buttonSecondaryBg)] text-[var(--color-buttonSecondaryText)]',
          'font-medium',
          'hover:opacity-90 hover:-translate-y-px',
        ].join(' '),
        ghost: 'text-wa-muted hover:bg-wa-border/30 hover:text-wa-text',
        link: 'text-wa-green underline-offset-4 hover:underline',
        success: [
          'text-white font-semibold',
          'bg-gradient-to-r from-[var(--color-accentSuccess)] to-[var(--color-accentAlt)]',
          'shadow-[0_2px_12px_rgba(37,211,102,0.25)]',
          'hover:shadow-[0_6px_20px_rgba(37,211,102,0.3)]',
          'hover:-translate-y-px hover:scale-[1.02]',
        ].join(' '),
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
