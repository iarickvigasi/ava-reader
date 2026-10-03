import { useTranslations } from "next-intl";
import { ReaderDownloadIcon } from "@/components/app/shared/app-icons";
import { useReaderUi } from "./reader-ui-context";

export function ReaderDownloadButton() {
  const t = useTranslations("nav.reader");
  const { activePanel, togglePanel } = useReaderUi();
  return (
    <button
      type="button"
      aria-label={t("downloadBook")}
      aria-expanded={activePanel === "download"}
      data-reader-download-control
      onClick={() => togglePanel("download")}
      className="flex size-10 shrink-0 items-center justify-center rounded-control text-title transition hover:bg-soft-tone-fill/75 focus-visible:ring-2 focus-visible:ring-line-strong"
    >
      <ReaderDownloadIcon aria-hidden="true" className="size-4.5" />
    </button>
  );
}
