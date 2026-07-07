import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl bg-surface-overlay border border-white/10 px-4 text-base text-ink",
        "placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-court",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-sm font-medium text-ink-dim mb-1.5", className)}
      {...props}
    />
  );
}
