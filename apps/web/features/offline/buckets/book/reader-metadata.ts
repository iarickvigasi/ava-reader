import type { ReaderBookPayload } from "@/lib/api-types/reader";

import type { AvaReaderDB, BookRow } from "../../db";
import { readKnownReaderLanguage } from "./reader-language";

export async function readReaderMetadata(
  db: AvaReaderDB,
  book: BookRow,
): Promise<ReaderBookPayload> {
  let language = readKnownReaderLanguage(book.metadata);
  if (language === undefined) {
    const item = await db.libraryItems.get(book.libraryItemId);
    language = readKnownReaderLanguage(item?.details);
  }
  return { ...(book.metadata as ReaderBookPayload), language: language ?? null };
}
