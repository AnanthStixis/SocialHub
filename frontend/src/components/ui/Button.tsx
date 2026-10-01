import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import { LoadingSpinner } from "./LoadingSpinner";

const variants = {
  primary: "bg-cta bg-cta-hover text-white shadow-[var(--shadow-cta)] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(15,118,110,0.26)] focus-visible:ring-primary-500",
  ai: "bg-ai-gradient bg-ai-gradient-hover text-white shadow-[0_4px_12px_rgba(124,58,237,0.22)] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(124,58,237,0.3)] focus-visible:ring-ai",
  secondary: "bg-primary-50 text-primary-600 hover:bg-primary-100 active:bg-primary-200 focus-visible:ring-gray-400",
  outline: "border border-gray-200 bg-white shadow-[var(--shadow-card)] text-gray-700 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-primary-500",
  danger: "bg-danger text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-400",
};
const sizes = { sm: "px-3 py-1.5 text-sm gap-1.5", md: "px-4 py-2 text-sm gap-2", lg: "px-6 py-3 text-base gap-2.5" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center rounded-[10px] font-medium transition-all duration-150 ease-out active:translate-y-0 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}
