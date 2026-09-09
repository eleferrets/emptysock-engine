import React from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "accent" | "green" | "red" | "yellow" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  variant = "default",
  children,
  className,
  style,
}: BadgeProps): React.ReactElement {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium",
        {
          "bg-[var(--es-surface-2)] text-[var(--es-text-muted)]":
            variant === "default",
          "bg-[rgba(124,106,247,0.2)] text-[var(--es-accent)]":
            variant === "accent",
          "bg-[rgba(74,222,128,0.15)] text-[var(--es-green)]":
            variant === "green",
          "bg-[rgba(248,113,113,0.15)] text-[var(--es-red)]": variant === "red",
          "bg-[rgba(250,204,21,0.15)] text-[var(--es-yellow)]":
            variant === "yellow",
          "bg-[rgba(96,165,250,0.15)] text-[var(--es-blue)]":
            variant === "blue",
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
