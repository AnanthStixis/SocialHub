import { useRef, useState } from "react";
import clsx from "clsx";
import { Film, Image as ImageIcon, Link as LinkIcon, Plus, Upload, X } from "lucide-react";

const MAX_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface LinkedMedia {
  url: string;
  media_type: "image" | "video";
}

const VIDEO_EXT = /\.(mp4|mov|webm)(\?.*)?$/i;

export default function MediaUploader({
  files,
  onChange,
  links = [],
  onLinksChange,
  onReject,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  links?: LinkedMedia[];
  onLinksChange?: (links: LinkedMedia[]) => void;
  onReject?: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  function addLink() {
    const url = urlDraft.trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      return onReject?.("Enter a valid image or video URL starting with http:// or https://");
    }
    if (links.some((l) => l.url === url)) return onReject?.("This URL has already been added");
    onLinksChange?.([...links, { url, media_type: VIDEO_EXT.test(url) ? "video" : "image" }]);
    setUrlDraft("");
  }
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) onReject?.(`"${f.name}" isn't supported. Please upload an image or video.`);
      else if (f.size > MAX_BYTES) onReject?.(`"${f.name}" is larger than the 50 MB limit.`);
      else accepted.push(f);
    }
    if (accepted.length) onChange([...files, ...accepted]);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-primary-400 hover:bg-gray-50",
        )}
      >
        <Upload size={22} className="text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Drag and drop or click to upload</p>
        <p className="text-xs text-gray-400">Images and videos, up to 50MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {onLinksChange && (
        <div>
          <div className="mb-2 flex items-center gap-3 text-xs text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            or add from a URL
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <button
              type="button"
              onClick={addLink}
              disabled={!urlDraft.trim()}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li key={l.url} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
              {l.media_type === "video" ? (
                <Film size={16} className="shrink-0 text-purple-500" />
              ) : (
                <img src={l.url} alt="" className="h-6 w-6 shrink-0 rounded object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
              <span className="flex-1 truncate text-sm text-gray-700">{l.url}</span>
              <button
                type="button"
                aria-label={`Remove ${l.url}`}
                onClick={() => onLinksChange?.(links.filter((_, j) => j !== i))}
                className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
              {f.type.startsWith("video/") ? (
                <Film size={16} className="shrink-0 text-purple-500" />
              ) : (
                <ImageIcon size={16} className="shrink-0 text-blue-500" />
              )}
              <span className="flex-1 truncate text-sm text-gray-700">{f.name}</span>
              <span className="text-xs text-gray-400">{formatSize(f.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
