"use client";
import { useBookDownload } from "@/features/library/downloads/use-book-download";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

export function useFormatDownload(status: PdfImportSummary, title: string) {
  return useBookDownload(status.libraryItemId, title);
}
