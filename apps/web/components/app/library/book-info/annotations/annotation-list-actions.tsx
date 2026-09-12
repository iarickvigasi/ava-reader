import { useTranslations } from "next-intl";
import { RowActionsMenuTrigger } from "@/components/app/reader/overlays/row-actions-menu-trigger";
import { useAnnotationListActions } from "@/features/library/use-annotation-list-actions";
import { AnnotationMenu } from "./annotation-menu";

export function AnnotationListActions({ title, disabled, onCopy }: {
  title: string;
  disabled: boolean;
  onCopy: () => Promise<void>;
}) {
  const t = useTranslations("library.bookInfo.annotations");
  const menu = useAnnotationListActions({ onCopy, disabled });
  const label = t("listActionsLabel", { title });
  return (
    <>
      <RowActionsMenuTrigger
        ariaLabel={label}
        buttonRef={menu.triggerRef}
        controlsId={menu.menuId}
        sizeClass="size-8"
        isOpen={menu.isMenuOpen}
        onToggle={menu.toggleMenu}
      />
      {menu.isMenuOpen ? (
        <AnnotationMenu
          id={menu.menuId}
          label={label}
          triggerRef={menu.triggerRef}
          onClose={menu.closeMenu}
          actions={[{
            kind: "copy", label: t("copyAll"), disabled: disabled || menu.isCopying,
            onClick: () => void menu.copyAll(),
          }]}
        />
      ) : null}
    </>
  );
}
