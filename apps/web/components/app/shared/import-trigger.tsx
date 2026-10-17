import { useTranslations } from "next-intl";
import { UploadIcon } from "./app-icons";
import { PendingLabel } from "./pending-label";
import { cn } from "@/lib/cn";
import {
  importButtonBase,
  importButtonSizes,
  importButtonVariants,
  type ImportButtonSize,
  type ImportButtonVariant,
} from "./import-button-styles";

export function ImportTrigger({
  label,
  variant,
  size,
  className,
  pending,
  onClick,
}: {
  label: string;
  variant: ImportButtonVariant;
  size: ImportButtonSize;
  className?: string;
  pending: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("shared.import");
  const icon = variant === "icon";
  return (
    <button
      type="button"
      className={cn(
        importButtonBase,
        importButtonVariants[variant],
        icon ? "" : importButtonSizes[size],
        className,
      )}
      disabled={pending}
      onClick={onClick}
    >
      {icon ? (
        <>
          <UploadIcon className="size-5 shrink-0" />
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <PendingLabel pending={pending} pendingText={t("uploading")}>
          <UploadIcon className="size-4 shrink-0" />
          {label}
        </PendingLabel>
      )}
    </button>
  );
}
