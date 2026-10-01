import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { fieldClass } from "./fieldStyles";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, children, ...rest }: SelectProps) {
  const id = rest.id || rest.name;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <select id={id} className={clsx(fieldClass(!!error, rest.disabled), "cursor-pointer appearance-none pr-10")} {...rest}>
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
