import { z } from 'zod';
import type { ImportManifest } from './manifest';

const verificationSchema = z.object({
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  language: z.string().min(2),
  method: z.literal('TEXT_SAMPLES'),
  notes: z.string().trim().min(20).max(4000),
  verifiedAt: z.string().datetime({ offset: true }),
});

export function verifiedImportLanguage(
  embedded: string | null,
  manifest: ImportManifest,
) {
  if (embedded?.trim()) return embedded;
  const result = verificationSchema.safeParse(
    manifest.fileMetadata.operatorLanguageVerification,
  );
  if (
    !result.success ||
    result.data.sha256 !== manifest.checksum ||
    result.data.language !== manifest.language ||
    Date.parse(result.data.verifiedAt) > Date.now()
  )
    return null;
  return result.data.language;
}
