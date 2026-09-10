export function normalizeCollectionText(value: string) {
  return value.trim().replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

export function collectionFieldErrors(name: string, description: string) {
  const title = normalizeCollectionText(name);
  return {
    name: !title ? "nameEmpty" : title.length > 100 ? "nameTooLong" : null,
    description:
      normalizeCollectionText(description).length > 1000
        ? "descriptionTooLong"
        : null,
  };
}
