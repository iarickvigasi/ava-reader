import { normalizeIsbn } from '../importer/normalize-isbn';
import type { Raw } from '../importer/types';

export function metadataOverrides(current: Raw, incoming: Raw): string[] {
  const overrides = new Set((current.metadataOverrides as string[]) ?? []);
  const relational = new Set([
    'texts',
    'credits',
    'identifiers',
    'aliases',
    'subjects',
  ]);
  for (const [key, value] of Object.entries(incoming)) {
    if (
      relational.has(key) ||
      ![
        'displayName',
        'originalTitle',
        'originalLanguage',
        'coverImageUrl',
        'categories',
        'title',
        'language',
        'format',
        'publishedYear',
        'publisher',
      ].includes(key)
    )
      continue;
    if (JSON.stringify(current[key] ?? null) !== JSON.stringify(value ?? null))
      overrides.add(key);
  }
  for (const key of ['aliases', 'subjects', 'credits', 'identifiers']) {
    const before = list(current[key]);
    const after = list(incoming[key]);
    if (incoming[key] === undefined) continue;
    for (const item of after) overrides.delete(`${key}:${identity(key, item)}`);
    for (const item of before) {
      const value = identity(key, item);
      if (!after.some((row) => identity(key, row) === value))
        overrides.add(`${key}:${value}`);
    }
  }
  const nextTexts = list(incoming.texts) as Raw[];
  if (incoming.texts !== undefined)
    for (const row of list(current.texts) as Raw[]) {
      const next = nextTexts.find((value) => value.locale === row.locale);
      const prefix = `texts:${String(row.locale)}`;
      if (!next) overrides.add(prefix);
      else {
        overrides.delete(prefix);
        for (const field of ['title', 'description', 'biography']) {
          if (field in next && (row[field] ?? null) !== (next[field] ?? null))
            overrides.add(`${prefix}:${field}`);
        }
      }
    }
  return [...overrides];
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function identity(key: string, value: unknown): string {
  if (typeof value === 'string') return value;
  const row = value as Raw;
  if (key === 'aliases') return String(row.name);
  if (key === 'credits') return `${String(row.authorId)}:${String(row.role)}`;
  const identifier = (row.identifier ?? row) as Raw;
  const scheme = String(identifier.scheme);
  const normalizedValue = String(identifier.normalizedValue);
  return scheme.startsWith('ISBN_')
    ? `ISBN_13:${normalizeIsbn(normalizedValue) ?? normalizedValue}`
    : `${scheme}:${normalizedValue}`;
}
