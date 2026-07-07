import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "line" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-court text-white hover:bg-court-dark",
  secondary: "bg-surface-overlay text-ink hover:bg-surface-overlay/80",
  ghost: "bg-transparent text-ink-dim hover:text-ink",
  line: "bg-line text-white hover:brightness-95",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-[0.98]",
        "disabled:opacity-50 disabled:pointer-events-none",
        size === "lg" ? "h-12 px-6 text-base w-full" : "h-10 px-4 text-sm",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
