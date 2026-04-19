export function formatAuthors(authors: string[] | null | undefined) {
  if (!Array.isArray(authors) || authors.length === 0) {
    return "Unknown author";
  }

  const normalizedAuthors = authors
    .map((author) => author.trim())
    .filter((author) => author.length > 0);

  if (normalizedAuthors.length === 0) {
    return "Unknown author";
  }

  return normalizedAuthors.join(", ");
}
