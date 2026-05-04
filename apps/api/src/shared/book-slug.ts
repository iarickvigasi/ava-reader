import { clampSlug, resolveUniqueSlug, slugifyPart } from './slugify';

const MAX_SLUG_LENGTH = 80;

export function buildBookSlugBase(input: { authors: string[]; title: string }) {
  const titlePart = slugifyPart(input.title ?? '');
  const authorPart = slugifyPart(input.authors?.[0] ?? '');

  const combined =
    titlePart && authorPart
      ? `${titlePart}-by-${authorPart}`
      : titlePart || authorPart || 'untitled';

  return clampSlug(combined, MAX_SLUG_LENGTH);
}

export const resolveUniqueBookSlug = resolveUniqueSlug;
