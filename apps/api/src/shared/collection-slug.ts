import { clampSlug, slugifyPart } from './slugify';

const MAX_SLUG_LENGTH = 60;

export function buildCollectionSlugBase(input: { name: string }) {
  const namePart = slugifyPart(input.name ?? '');
  const base = namePart || 'collection';

  return clampSlug(base, MAX_SLUG_LENGTH);
}
