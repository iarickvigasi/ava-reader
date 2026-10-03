import { z } from 'zod';
import { runSandbox } from '../../../pdf-conversion/runtime/run-sandbox';
import type { PdfRuntimeConfig } from '../../../pdf-conversion/runtime/runtime-config';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { PdfPublicationError } from './errors';
const schema = z
  .object({
    schema_version: z.literal('ava-epub-validation-1'),
    epub_sha256: z.string(),
    canonical_sha256: z.string(),
    canonical_conservation: z.literal('pass'),
    reader_package: z.unknown(),
    epubcheck: z
      .object({
        status: z.literal('pass'),
        version: z.literal('5.4.0'),
        distribution_sha256: z.literal(
          '41710888ac4c99ef9325ab07570d7acdaa907e2110a532aceca66f4f52a0b6c9',
        ),
        errors: z.array(z.string()).max(0),
        warnings: z.array(z.string().max(100)).max(10000),
      })
      .strict(),
  })
  .strict();
export async function validateCandidateEpub(input: {
  epub: Buffer;
  epubSha: string;
  canonicalSha: string;
  finalContentId: string;
  runtime: PdfRuntimeConfig;
  semantic: SemanticValidator;
  signal?: AbortSignal;
  leaseRemainingMs?: () => number;
}) {
  const result = await runSandbox(
    {
      source: input.epub,
      jobBytes: Buffer.from(
        JSON.stringify({
          epub_sha256: input.epubSha,
          canonical_sha256: input.canonicalSha,
          final_content_id: input.finalContentId,
        }),
      ),
      module: 'ava_pdf_epub.runtime.validate_epub',
      deadlineMs: 180000,
      scratchBytes: 1073741824,
      signal: input.signal,
      leaseRemainingMs: input.leaseRemainingMs,
    },
    input.runtime,
  );
  if (result.exitCode !== 0) {
    let hard = false;
    try {
      const error = JSON.parse(result.stdout.toString('utf8')) as {
        schema_version?: unknown;
        code?: unknown;
      };
      hard =
        error.schema_version === 'ava-epub-validation-error-1' &&
        error.code === 'INVALID_EPUB';
    } catch {
      /* Missing validator evidence never proves content invalid. */
    }
    throw new PdfPublicationError(
      hard ? 'PDF_EPUB_VALIDATION_FAILED' : 'PDF_VALIDATOR_UNAVAILABLE',
    );
  }
  const report = schema.parse(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.stdout)),
  );
  if (
    report.epub_sha256 !== input.epubSha ||
    report.canonical_sha256 !== input.canonicalSha
  )
    throw new PdfPublicationError('PDF_EPUB_VALIDATION_FAILED');
  const readerBytes = Buffer.from(JSON.stringify(report.reader_package));
  const reader = await validateContract(
    'ava-reader-3',
    readerBytes,
    input.semantic,
  );
  if (
    reader.final_content_id !== input.finalContentId ||
    reader.canonical_sha256 !== input.canonicalSha
  )
    throw new PdfPublicationError('PDF_EPUB_VALIDATION_FAILED');
  return { reader, readerBytes, epubcheck: report.epubcheck };
}
