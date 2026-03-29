import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-wa-medium text-white shadow-sm',
        connected: 'border-wa-green/30 bg-wa-green/15 text-wa-green shadow-[0_0_6px_rgba(37,211,102,0.15)]',
        disconnected: 'border-red-500/30 bg-red-500/15 text-red-400',
        qr: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-wa-border text-wa-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
