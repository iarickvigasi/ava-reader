import { strings } from './raw-fields';
import { normalizeIsbn } from './normalize-isbn';
import type { Raw } from './types';

export function isbnValues(raw: Raw) {
  return [
    ...new Set(
      [
        ...(strings(raw.isbn_10) ?? []),
        ...(strings(raw.isbn_13) ?? []),
      ].flatMap((value) => normalizeIsbn(value) ?? []),
    ),
  ];
}
