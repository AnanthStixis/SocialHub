/** Feedwren brand wordmark: Sora display face, "Feed" in ink, "wren" in brand teal. */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-brand font-semibold tracking-[-0.04em] text-gray-900 ${className}`}>
      Feed<span className="text-primary">wren</span>
    </span>
  );
}
