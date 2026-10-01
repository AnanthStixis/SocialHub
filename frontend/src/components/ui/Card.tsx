import type { HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ padding = true, className, ...rest }: CardProps) {
  return <div className={clsx("rounded-2xl border border-gray-200 bg-surface shadow-[var(--shadow-card)] transition-colors duration-150 hover:border-gray-300", padding && "p-6", className)} {...rest} />;
}

Card.Header = function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("mb-4 border-b border-gray-100 pb-4", className)} {...rest} />;
};
Card.Footer = function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("mt-4 border-t border-gray-100 pt-4", className)} {...rest} />;
};
