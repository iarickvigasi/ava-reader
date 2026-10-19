import { getDb, type AvaReaderDB } from "@/features/offline/db";
import type { LibraryBookInfo } from "@/lib/api-types";
import type {
  PdfMetadata,
  PdfMetadataDraft,
} from "@/lib/api-types/pdf-metadata";
export type Editor = {
  scope: string;
  db: AvaReaderDB;
  draft: PdfMetadataDraft;
  snapshot: PdfMetadata | null;
  pending: boolean;
  error: "loadFailed" | "saveFailed" | "conflict" | "invalid" | null;
};
export function initialEditor(book: LibraryBookInfo, scope: string): Editor {
  return {
    scope,
    db: getDb(),
    draft: {
      title: book.title,
      authors: book.authors.join("\n"),
      language: book.language ?? "",
    },
    snapshot: null,
    pending: false,
    error: null,
  };
}
