import type { LibraryBookInfo } from "@/lib/api-types/library";
import type { LibraryItemRow } from "../../../db";

export type BookInfoRowInput = {
  book: LibraryBookInfo;
  prior: LibraryItemRow | undefined;
  finishedAt: string | null;
  retainCollections: boolean;
  nowIso: string;
};

export type BookInfoOverlays = Pick<
  LibraryBookInfo,
  "finishedAt" | "collections"
>;

export type BookInfoDetails = NonNullable<LibraryItemRow["details"]>;
