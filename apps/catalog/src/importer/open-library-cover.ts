import { coverId } from './cover-id';
import { InvalidRecord } from './types';

export function openLibraryCover(value: unknown) {
  if (value === undefined) return {};
  if (!Array.isArray(value))
    throw new InvalidRecord('Expected a cover ID array');
  const id = coverId(value) ?? null;
  return {
    coverId: id,
    coverImageUrl: id
      ? `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`
      : null,
  };
}
