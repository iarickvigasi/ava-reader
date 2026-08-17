import { BadRequestException } from '@nestjs/common';
import type { ReaderPackage } from '../reader-types';
import {
  normalizeLegacyReaderPackage,
  normalizeReaderPackageManifestAuthors,
  type LegacyReaderPackage,
  type ReaderPackageWithLegacyAuthors,
} from './normalize-reader-package';

// The single entry point for reading a stored package. book-analysis parses
// through this too, rather than growing a second parser that could drift from
// the legacy normalisation the reader depends on.
export function parseReaderPackage(buffer: Buffer): ReaderPackage {
  const raw = JSON.parse(buffer.toString('utf8')) as unknown;
  const candidate =
    raw && typeof raw === 'object'
      ? (raw as { chapters?: unknown; version?: unknown })
      : null;

  if (
    !candidate ||
    (candidate.version !== 1 && candidate.version !== 2) ||
    !Array.isArray(candidate.chapters)
  ) {
    throw new BadRequestException('The stored reader package is invalid.');
  }

  if (candidate.version === 1) {
    return normalizeLegacyReaderPackage(raw as LegacyReaderPackage);
  }

  return normalizeReaderPackageManifestAuthors(
    raw as ReaderPackageWithLegacyAuthors,
  );
}
