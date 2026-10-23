import { InvalidRecord, type Raw } from './types';

export function object(value: unknown): Raw {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidRecord('Expected a JSON object');
  }
  return value as Raw;
}

export function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return text((value as Raw).value);
  }
  return undefined;
}

export function strings(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new InvalidRecord('Expected a string array');
  return [...new Set(value.flatMap((item: unknown) => text(item) ?? []))];
}

export function references(
  value: unknown,
  kind: 'authors' | 'works',
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new InvalidRecord('Expected a reference array');
  return [
    ...new Set(
      value.map((item: unknown) => {
        const entry = object(item);
        const key = object(entry.author ?? entry).key;
        const pattern =
          kind === 'authors' ? /^\/authors\/OL\d+A$/ : /^\/works\/OL\d+W$/;
        if (typeof key !== 'string' || !pattern.test(key))
          throw new InvalidRecord('Invalid reference');
        return key;
      }),
    ),
  ];
}
