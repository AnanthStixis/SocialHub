import { ALL_PLATFORMS, Platform } from "@/lib/types";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORM_ICONS } from "@/components/PlatformIcon";

// Mirrors the reference template: bare brand-coloured icon when unselected,
// white icon on a brand-coloured fill when selected. `compact` is the smaller
// variant the template uses inside the AI assistant panel.
export default function PlatformSelector({
  selected,
  onChange,
  compact = false,
}: {
  selected: Platform[];
  onChange: (next: Platform[]) => void;
  compact?: boolean;
}) {
  const toggle = (p: Platform) => onChange(selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p]);

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
      {ALL_PLATFORMS.map((p) => {
        const isSelected = selected.includes(p);
        const { name, color } = PLATFORM_META[p];
        const Icon = PLATFORM_ICONS[p];

        const classes = compact
          ? [
              "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer border",
              isSelected ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
            ]
          : [
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer border",
              isSelected ? "text-white shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50",
            ];

        return (
          <button
            key={p}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(p)}
            className={classes.join(" ")}
            style={isSelected ? { backgroundColor: color, borderColor: color } : undefined}
          >
            <Icon size={compact ? 12 : 16} className={isSelected ? "text-white" : undefined} style={isSelected ? undefined : { color }} />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
