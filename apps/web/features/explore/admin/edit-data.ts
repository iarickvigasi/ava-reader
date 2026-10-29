import type {
  EditData,
  EditorialKind,
  EditorialRecord,
  MetadataRow,
} from "./types";

export function editData(
  kind: EditorialKind,
  record: EditorialRecord,
): EditData {
  const credits =
    (
      record.credits as
        | {
            author: { id: string; displayName: string };
            role: string;
            creditedAs: string | null;
          }[]
        | undefined
    )?.map((credit) => ({
      authorId: credit.author.id,
      authorName: credit.author.displayName,
      role: credit.role,
      creditedAs: credit.creditedAs,
    })) ?? [];
  const texts = (record.texts ?? []) as MetadataRow[];
  if (kind === "authors")
    return {
      displayName: record.displayName,
      aliases: (record.aliases as { name: string }[]).map(
        (alias) => alias.name,
      ),
      texts,
    };
  if (kind === "works")
    return {
      originalTitle: record.originalTitle,
      originalLanguage: record.originalLanguage,
      coverImageUrl: record.coverImageUrl,
      subjects: record.subjects,
      categories: record.categories,
      credits,
      texts,
    };
  return {
    title: record.title,
    language: record.language,
    publisher: record.publisher,
    publishedYear: record.publishedYear,
    format: record.format,
    coverImageUrl: record.coverImageUrl,
    credits,
    identifiers: (record.identifiers as { identifier: MetadataRow }[]).map(
      (row) => row.identifier,
    ),
  };
}
