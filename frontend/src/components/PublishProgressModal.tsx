import { CheckCircle2, XCircle } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import { Platform } from "@/lib/types";
import { Button, LoadingSpinner, Modal } from "@/components/ui";

export interface PublishProgressItem {
  platform: string;
  state: "pending" | "done" | "failed";
  error?: string;
}

export default function PublishProgressModal({
  items,
  publishing,
  onClose,
}: {
  items: PublishProgressItem[];
  publishing: boolean;
  onClose: () => void;
}) {
  const anyFailed = items.some((i) => i.state === "failed");

  return (
    <Modal
      isOpen
      onClose={() => !publishing && onClose()}
      title={publishing ? "Publishing..." : "Publish complete"}
      size="sm"
    >
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.platform} className="rounded-lg border border-gray-100 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <PlatformIcon platform={item.platform as Platform} />
                {item.platform.charAt(0) + item.platform.slice(1).toLowerCase()}
              </span>
              {item.state === "pending" && <LoadingSpinner size="sm" className="text-gray-400" />}
              {item.state === "done" && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <CheckCircle2 size={16} /> Done
                </span>
              )}
              {item.state === "failed" && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <XCircle size={16} /> Failed
                </span>
              )}
            </div>
            {item.state === "failed" && item.error && <p className="mt-1 text-xs text-red-600">{item.error}</p>}
          </div>
        ))}
      </div>

      {!publishing && (
        <Button variant={anyFailed ? "secondary" : "primary"} className="mt-4 w-full" onClick={onClose}>
          Close
        </Button>
      )}
    </Modal>
  );
}
