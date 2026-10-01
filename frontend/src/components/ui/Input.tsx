import type { InputHTMLAttributes } from "react";
import clsx from "clsx";
import { fieldClass } from "./fieldStyles";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className, ...rest }: InputProps) {
  const id = rest.id || rest.name;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>}
      <input id={id} className={fieldClass(!!error, rest.disabled)} {...rest} />
      {error ? <p className="text-sm text-red-600">{error}</p> : helperText && <p className="text-sm text-gray-500">{helperText}</p>}
    </div>
  );
}
