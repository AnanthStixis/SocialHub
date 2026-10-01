import clsx from "clsx";

export function fieldClass(error?: boolean, disabled?: boolean) {
  return clsx(
    "block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-150",
    "focus:outline-none focus:ring-2",
    error ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-primary-500 focus:ring-primary-500/20",
    disabled ? "cursor-not-allowed bg-gray-50 opacity-60" : "bg-white",
  );
}
