export type PdfMetadata = {
  operationId: string;
  libraryItemId: string;
  metadataEditVersion: number;
  title: string;
  authors: string[];
  language: string | null;
};
export type PdfMetadataDraft = {
  title: string;
  authors: string;
  language: string;
};

export function metadataDraft(snapshot: PdfMetadata): PdfMetadataDraft {
  return {
    title: snapshot.title,
    authors: snapshot.authors.join("\n"),
    language: snapshot.language ?? "",
  };
}
export function metadataChanges(draft: PdfMetadataDraft) {
  const title = draft.title.trim();
  const authors = draft.authors
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const language = draft.language.trim() || null;
  if (
    !title ||
    title.length > 1000 ||
    authors.length > 100 ||
    authors.some((value) => value.length > 1000) ||
    (language && (language.length < 2 || language.length > 35))
  )
    return null;
  return { title, authors, language };
}
export function metadataPatch(snapshot: PdfMetadata, draft: PdfMetadataDraft) {
  const values = metadataChanges(draft);
  const prior = metadataChanges(metadataDraft(snapshot));
  if (!values || !prior) return null;
  const patch: {
    title?: string;
    authors?: string[];
    language?: string | null;
  } = {};
  if (values.title !== prior.title) patch.title = values.title;
  if (
    values.authors.length !== prior.authors.length ||
    values.authors.some((author, index) => author !== prior.authors[index])
  )
    patch.authors = values.authors;
  if (values.language !== prior.language) patch.language = values.language;
  return Object.keys(patch).length ? patch : null;
}
export function readPdfMetadata(value: unknown): PdfMetadata | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    ![v.operationId, v.libraryItemId].every(
      (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id),
    ) ||
    !Number.isSafeInteger(v.metadataEditVersion) ||
    (v.metadataEditVersion as number) < 0 ||
    (v.metadataEditVersion as number) > 2147483647 ||
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 1000 ||
    !Array.isArray(v.authors) ||
    v.authors.length > 100 ||
    v.authors.some(
      (author) =>
        typeof author !== "string" || !author.trim() || author.length > 1000,
    ) ||
    (v.language !== null &&
      (typeof v.language !== "string" ||
        v.language.length < 2 ||
        v.language.length > 35))
  )
    return null;
  return {
    operationId: v.operationId as string,
    libraryItemId: v.libraryItemId as string,
    metadataEditVersion: v.metadataEditVersion as number,
    title: v.title,
    authors: v.authors as string[],
    language: v.language as string | null,
  };
}
