import { PublicationFormat } from '#catalog-client';
import { openLibraryCover } from './open-library-cover';
import { strings, text } from './raw-fields';
import { normalizeLanguage } from './normalize-language';
import type { Raw } from './types';

export function editionData(raw: Raw, workId: string, revision: number) {
  const language = Array.isArray(raw.languages)
    ? normalizeLanguage(raw.languages[0])
    : undefined;
  const year = text(raw.publish_date)?.match(/\b([12]\d{3})\b/);
  return {
    title: text(raw.title)!,
    workId,
    ...openLibraryCover(raw.covers),
    language,
    publisher: strings(raw.publishers)?.[0],
    publishedYear: year ? Number(year[1]) : undefined,
    format: format(raw.physical_format),
    revision,
  };
}

function format(value: unknown) {
  const name = text(value)?.toLowerCase();
  if (!name) return undefined;
  if (['epub', 'ebook', 'e-book', 'electronic resource'].includes(name))
    return PublicationFormat.EBOOK;
  if (name.includes('paperback')) return PublicationFormat.PAPERBACK;
  if (name.includes('hardcover') || name.includes('hardback'))
    return PublicationFormat.HARDCOVER;
  if (name.includes('audio')) return PublicationFormat.AUDIOBOOK;
  return PublicationFormat.UNKNOWN;
}
