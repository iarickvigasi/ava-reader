import { ConflictException } from '@nestjs/common';
import { parseImportManifest, type ImportManifest } from './manifest';

export function assertReplayManifest(
  evidence: unknown,
  manifest: ImportManifest,
) {
  const original = parseImportManifest(JSON.stringify(evidence));
  if (
    original.language !== manifest.language ||
    original.provider !== manifest.provider ||
    original.providerId !== manifest.providerId ||
    original.iaIdentifier !== manifest.iaIdentifier ||
    original.externalId !== manifest.externalId ||
    (original.review &&
      manifest.review &&
      original.review.rightsJurisdiction !== manifest.review.rightsJurisdiction)
  )
    throw new ConflictException(
      'Existing import language/rights scope differs; review the existing edition before relinking',
    );
}
