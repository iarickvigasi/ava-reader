import type { LibraryCardBook } from "@/lib/api-types/library";
import { isPdfReadable } from "./pdf-imports/is-readable";

export function isBookReadable(
  book: Pick<LibraryCardBook, "pdfImport" | "epubImport">,
) {
  return (
    isPdfReadable(book.pdfImport) &&
    (!book.epubImport ||
      (book.epubImport.status === "READY" &&
        Boolean(book.epubImport.finalContentId)))
  );
}
