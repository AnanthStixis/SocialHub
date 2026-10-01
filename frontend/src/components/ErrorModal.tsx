import { AlertCircle } from "lucide-react";
import { Button, Modal } from "@/components/ui";

export default function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Modal isOpen onClose={onClose} title="Something went wrong" size="sm">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      <Button variant="secondary" onClick={onClose} className="mt-4 w-full">
        Close
      </Button>
    </Modal>
  );
}
