import type { HomePayload } from "@/lib/api-types/home";
import type { LibraryItemRow } from "../../db";
import { keepPriorMetadata } from "../library/pdf-imports/metadata/version";
export function composeHomeMetadata(
  payload: HomePayload,
  row?: LibraryItemRow,
): HomePayload {
  const current = payload.currentEngagement;
  if (
    !current ||
    !row ||
    current.libraryItemId !== row.libraryItemId ||
    !keepPriorMetadata(row.metadataEditVersion, current.metadataEditVersion)
  )
    return payload;
  return {
    ...payload,
    currentEngagement: {
      ...current,
      title: row.title,
      authors: row.authors,
      metadataEditVersion: row.metadataEditVersion,
    },
    ...(payload.listening
      ? {
          listening: {
            ...payload.listening,
            title: row.title,
            authorLine: row.authors.length
              ? row.authors.join(", ")
              : "Unknown author",
          },
        }
      : {}),
  };
}
