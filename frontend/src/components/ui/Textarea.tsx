import type { TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { fieldClass } from "./fieldStyles";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({ label, error, helperText, className, ...rest }: TextareaProps) {
  const id = rest.id || rest.name;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea id={id} className={clsx(fieldClass(!!error, rest.disabled), "min-h-[80px] resize-y")} {...rest} />
      {error ? <p className="text-sm text-red-600">{error}</p> : helperText && <p className="text-sm text-gray-500">{helperText}</p>}
    </div>
  );
}
