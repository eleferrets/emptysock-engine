import React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'accent' | 'green' | 'red' | 'yellow' | 'blue';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium',
        {
          'bg-[var(--surface-2)] text-[var(--text-muted)]': variant === 'default',
          'bg-[rgba(124,106,247,0.2)] text-[var(--accent)]': variant === 'accent',
          'bg-[rgba(74,222,128,0.15)] text-[var(--green)]': variant === 'green',
          'bg-[rgba(248,113,113,0.15)] text-[var(--red)]': variant === 'red',
          'bg-[rgba(250,204,21,0.15)] text-[var(--yellow)]': variant === 'yellow',
          'bg-[rgba(96,165,250,0.15)] text-[var(--blue)]': variant === 'blue',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
