import type { ReactNode } from "react";
import { Button } from "./button";
export function ModalActions({
  cancelLabel,
  onCancel,
  pending = false,
  children,
}: {
  cancelLabel: string;
  onCancel: () => void;
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="soft"
        disabled={pending}
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
      {children}
    </div>
  );
}
