import type { ReactNode } from "react";
import { useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RowActionsMenuTrigger } from "@/components/app/reader/overlays/row-actions-menu-trigger";
import { AnnotationMenu } from "./annotation-menu";

type AnnotationRowProps = {
  text: string;
  metadata?: string;
  onDelete: () => void;
  children?: ReactNode;
};

export function AnnotationRow({ text, metadata, onDelete, children }: AnnotationRowProps) {
  const t = useTranslations("library.bookInfo.annotations");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const actionsLabel = t("actionsLabel", { text });

  return (
    <li className="group/highlight-row space-y-3 py-5 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-ui text-xs text-muted">{metadata}</p>
        <RowActionsMenuTrigger
          ariaLabel={actionsLabel}
          buttonRef={triggerRef}
          controlsId={menuId}
          group="highlight-row"
          isOpen={isMenuOpen}
          onToggle={() => setIsMenuOpen((current) => !current)}
        />
      </div>
      {isMenuOpen ? (
        <AnnotationMenu
          id={menuId}
          label={actionsLabel}
          triggerRef={triggerRef}
          onClose={closeMenu}
          actions={[{ kind: "delete", label: t("delete"), onClick: () => {
            closeMenu();
            onDelete();
          } }]}
        />
      ) : null}
      <p className="whitespace-pre-wrap break-words font-reader text-[1.05rem] leading-relaxed text-title">
        {text}
      </p>
      {children}
    </li>
  );
}
