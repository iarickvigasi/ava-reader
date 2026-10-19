import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

export function pdfDetailsRevision(book: {
  metadataEditVersion?: number;
  pdfImport?: PdfImportSummary | null;
}): string | undefined {
  if (!book.pdfImport) return undefined;
  return JSON.stringify([
    book.pdfImport.operationId,
    book.pdfImport.status,
    book.metadataEditVersion ?? null,
  ]);
}
