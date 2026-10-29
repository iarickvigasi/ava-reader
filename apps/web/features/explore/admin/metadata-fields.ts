import type { EditorialKind } from "./types";

export function metadataFields(kind: EditorialKind) {
  if (kind === "authors")
    return [{ key: "displayName", label: "authorName", required: true }];
  return [
    {
      key: kind === "works" ? "originalTitle" : "title",
      label: "title",
      required: true,
    },
    {
      key: kind === "works" ? "originalLanguage" : "language",
      label: "language",
    },
    { key: "coverImageUrl", label: "cover", type: "url" },
    ...(kind === "editions"
      ? [
          { key: "publisher", label: "publisher" },
          { key: "publishedYear", label: "year", type: "number" },
        ]
      : []),
  ];
}
