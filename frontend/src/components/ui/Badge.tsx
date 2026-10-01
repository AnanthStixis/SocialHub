import type { ReactNode } from "react";
import clsx from "clsx";

const variants = {
  default: "bg-gray-100 text-gray-700",
  primary: "bg-primary-50 text-primary-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-yellow-50 text-yellow-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
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
