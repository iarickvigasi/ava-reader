import { BadRequestException } from '@nestjs/common';

import { CATEGORY_KEYS } from '../importer/reader-categories';
export const BROWSE_FILTERS = ['readable', ...CATEGORY_KEYS];
export type BrowseQuery = {
  query: string;
  languages: string[];
  filters: string[];
  cursor?: string;
  before?: string;
  limit: number;
};

export function parseBrowseQuery(raw: Record<string, unknown>): BrowseQuery {
  const text = (key: string) => {
    const value = raw[key];
    if (value === undefined) return '';
    if (typeof value !== 'string')
      throw new BadRequestException(`Invalid ${key}`);
    return value.trim();
  };
  const query = text('query');
  const languages = text('languages').split(',').filter(Boolean);
  const filters = text('filters').split(',').filter(Boolean);
  const limitText = text('limit');
  const limit = limitText ? Number(limitText) : 20;
  const cursor = text('cursor') || undefined;
  const before = text('before') || undefined;
  if (
    query.length > 200 ||
    languages.length > 20 ||
    filters.length > BROWSE_FILTERS.length ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 40 ||
    languages.some((v) => !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(v)) ||
    filters.some((v) => !BROWSE_FILTERS.some((known) => known === v)) ||
    (cursor && before) ||
    [cursor, before].some(
      (boundary) =>
        boundary &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          boundary,
        ),
    )
  ) {
    throw new BadRequestException('Invalid catalog query');
  }
  return { query, languages, filters, cursor, before, limit };
}
