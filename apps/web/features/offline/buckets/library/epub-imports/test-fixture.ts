import type { EpubImportSummary } from "@/lib/api-types/epub-import";
import { book } from "../pdf-imports/metadata/test-fixture";

export const pending: EpubImportSummary = {
  status: "PENDING",
  runId: "run",
  finalContentId: null,
  updatedAt: "2026-10-15T10:00:00.000Z",
};
export const ready: EpubImportSummary = {
  ...pending,
  status: "READY",
  finalContentId: "content",
  updatedAt: "2026-10-15T10:01:00.000Z",
};
export const nativeBook = {
  ...book,
  primaryFormat: "EPUB" as const,
  pdfImport: null,
  epubImport: pending,
  title: "Filename",
  language: null,
};
export const readyBook = {
  ...nativeBook,
  epubImport: ready,
  title: "Printed title",
  language: "uk",
  coverImageUrl: "/owned-cover",
};
