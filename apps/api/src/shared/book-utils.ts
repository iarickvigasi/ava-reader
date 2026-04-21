import { BookFileFormat } from '@prisma/client';

export function inferMimeType(format: BookFileFormat) {
  if (format === BookFileFormat.EPUB) {
    return 'application/epub+zip';
  }

  if (format === BookFileFormat.PDF) {
    return 'application/pdf';
  }

  return 'application/octet-stream';
}

export function normalizeBookLanguage(
  value: null | string | undefined,
): null | string {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new Intl.Locale(trimmed.replace(/_/g, '-')).toString();
  } catch {
    return trimmed;
  }
}
