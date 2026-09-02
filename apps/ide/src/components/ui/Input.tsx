import React from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({
  className,
  label,
  id,
  ...props
}: InputProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      {label !== undefined && (
        <label
          htmlFor={id}
          className="text-[10px] uppercase tracking-wider text-[var(--es-text-muted)] font-medium"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "bg-[var(--es-bg)] border border-[var(--es-border)] rounded px-2 py-1 text-xs text-[var(--es-text)]",
          "focus:outline-none focus:border-[var(--es-accent)] transition-colors",
          "placeholder:text-[var(--es-text-muted)]",
          "font-mono",
          className,
        )}
        {...props}
      />
    </div>
  );
}
