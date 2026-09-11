import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { RowActionsMenu, type RowAction } from "@/components/app/reader/overlays/row-actions-menu";
import { useAnnotationMenu } from "@/features/library/use-annotation-menu";

type AnnotationMenuProps = {
  id: string;
  label: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  actions: RowAction[];
  onClose: () => void;
};

export function AnnotationMenu({ id, label, triggerRef, actions, onClose }: AnnotationMenuProps) {
  const menuRef = useAnnotationMenu(triggerRef, onClose);
  return createPortal(
    <div ref={menuRef} id={id} className="fixed z-50">
      <RowActionsMenu placement="popover" ariaLabel={label} actions={actions} />
    </div>,
    document.body,
  );
}
