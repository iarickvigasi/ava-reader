import type { MetadataClaim } from '../contracts/generated/ava-book-2';

export function acceptedDisplayMetadata(claims: MetadataClaim[]) {
  const accepted = claims.filter(
    (c) => c.status === 'accepted' && c.value?.trim(),
  );
  const values = (field: MetadataClaim['field']) => [
    ...new Set(
      accepted.filter((c) => c.field === field).map((c) => c.value!.trim()),
    ),
  ];
  const title = values('title');
  const language = values('language');
  const authors = [
    ...new Set(
      accepted
        .filter(
          (c) => c.field === 'contributor' && c.contributor_role === 'author',
        )
        .map((c) => c.value!.trim()),
    ),
  ];
  return {
    ...(title.length === 1 && title[0].length <= 1000
      ? { title: title[0] }
      : {}),
    ...(authors.length &&
    authors.length <= 100 &&
    authors.every((a) => a.length <= 1000)
      ? { authors }
      : {}),
    ...(language.length === 1 &&
    language[0].length >= 2 &&
    language[0].length <= 35
      ? { language: language[0] }
      : {}),
  };
}
