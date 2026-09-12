import type { BookFileFormat } from "./shared";

export type ReaderBookPayload = {
  authors: string[];
  language: string | null;
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};
