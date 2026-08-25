import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ className, label, id, ...props }: InputProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      {label !== undefined && (
        <label
          htmlFor={id}
          className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]',
          'focus:outline-none focus:border-[var(--accent)] transition-colors',
          'placeholder:text-[var(--text-muted)]',
          'font-mono',
          className
        )}
        {...props}
      />
    </div>
  );
}
