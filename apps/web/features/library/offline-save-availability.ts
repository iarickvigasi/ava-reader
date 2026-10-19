import type { LibraryCardBook } from "@/lib/api-types/library";
import { isBookReadable } from "./is-book-readable";

export function offlineSaveAvailability(
  imports: Pick<LibraryCardBook, "pdfImport" | "epubImport">,
) {
  const failed =
    imports.pdfImport?.status === "FAILED" ||
    imports.pdfImport?.status === "STOPPED" ||
    imports.epubImport?.status === "FAILED";
  const disabled =
    !isBookReadable(imports) && (Boolean(imports.epubImport) || failed);
  return {
    disabled,
    description: disabled
      ? failed
        ? "idle.unavailableDescription"
        : "idle.preparingDescription"
      : "idle.description",
  } as const;
}
