import clsx from "clsx";

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base", xl: "h-16 w-16 text-lg" };
const colors = ["bg-primary-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-red-500", "bg-pink-500", "bg-purple-500", "bg-teal-500"];

function initials(name?: string) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function colorFor(name?: string) {
  let h = 0;
  for (const c of name ?? "") h = c.charCodeAt(0) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export function Avatar({ src, name, size = "md", className }: { src?: string; name?: string; size?: keyof typeof sizes; className?: string }) {
  if (src) return <img src={src} alt={name ?? "Avatar"} className={clsx("shrink-0 rounded-full object-cover", sizes[size], className)} />;
  return (
    <div title={name} className={clsx("flex shrink-0 items-center justify-center rounded-full font-medium text-white", sizes[size], colorFor(name), className)}>
      {initials(name)}
    </div>
  );
}
