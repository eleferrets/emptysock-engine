import React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "ghost" | "accent" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--es-accent)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        {
          // variants
          "bg-[var(--es-surface-2)] text-[var(--es-text)] hover:bg-[#2a2a34] active:bg-[#222228]":
            variant === "default",
          "bg-transparent text-[var(--es-text-muted)] hover:text-[var(--es-text)] hover:bg-[var(--es-surface-2)]":
            variant === "ghost",
          "bg-[var(--es-accent)] text-white hover:bg-[var(--es-accent-dim)] active:bg-[#4a3ec4]":
            variant === "accent",
          "bg-transparent text-[var(--es-red)] hover:bg-[rgba(248,113,113,0.1)]":
            variant === "danger",
          "border border-[var(--es-border)] text-[var(--es-text-muted)] hover:text-[var(--es-text)] hover:border-[var(--es-accent)]":
            variant === "outline",
          // sizes
          "text-xs px-2.5 py-1": size === "sm",
          "text-xs px-3 py-1.5": size === "md",
          "w-7 h-7 p-0": size === "icon",
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
