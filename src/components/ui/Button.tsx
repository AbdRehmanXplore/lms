import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2",
        variant === "primary" &&
          "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] text-white shadow-sm shadow-blue-500/20",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] hover:bg-[var(--border-strong)] hover:border-[var(--border-strong)]",
        variant === "danger" &&
          "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30",
        variant === "ghost" &&
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors",
        variant === "success" &&
          "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        className,
      )}
      {...props}
    />
  );
}
