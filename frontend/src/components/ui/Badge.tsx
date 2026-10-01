import type { ReactNode } from "react";
import clsx from "clsx";

const variants = {
  default: "bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200",
  primary: "bg-primary-50 text-primary-700",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  ai: "bg-ai-light text-ai",
  info: "bg-blue-light text-blue",
};
const sizes = { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm" };

export function Badge({ children, variant = "default", size = "sm", className }: {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full font-medium", variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}
