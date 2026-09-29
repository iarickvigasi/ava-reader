import type { LibraryBookInfo } from "@/lib/api-types";
import type { PdfMetadata } from "@/lib/api-types/pdf-metadata";
import { pdfStatus } from "../test-fixture";
export const book: LibraryBookInfo = {
  libraryItemId: "lib-1",
  slug: "book",
  title: "Original",
  authors: ["Original author"],
  coverImageUrl: null,
  completionPercent: 0,
  primaryFormat: "PDF",
  pdfImport: pdfStatus,
  metadataEditVersion: 0,
  addedAt: "2026-09-29T00:00:00Z",
  approximateBodyPageCount: null,
  approximatePageCount: null,
  chapterLabel: null,
  collections: [],
  description: null,
  genres: [],
  finishedAt: null,
  language: "en",
  lastReadAt: null,
  minutesRead: 0,
  publishedYear: null,
  source: "IMPORTED",
};
export const edited: PdfMetadata = {
  operationId: "operation",
  libraryItemId: "lib-1",
  metadataEditVersion: 1,
  title: "My title",
  authors: [],
  language: null,
};
