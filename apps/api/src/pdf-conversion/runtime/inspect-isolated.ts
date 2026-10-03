import { createHash } from 'node:crypto';
import { runSandbox } from './run-sandbox';
import { PdfRuntimeError } from './runtime-error';
import type { PdfRuntimeConfig } from './runtime-config';

export async function inspectPdfIsolated(
  bytes: Buffer,
  sourceSha256: string,
  config: PdfRuntimeConfig,
) {
  const source = Buffer.from(bytes);
  if (createHash('sha256').update(source).digest('hex') !== sourceSha256)
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const response = await runSandbox(
    {
      source,
      module: 'ava_pdf_epub.runtime.inspect',
      deadlineMs: 30000,
      scratchBytes: 64 * 1024 ** 2,
    },
    config,
  );
  if (response.exitCode !== 0) throw new PdfRuntimeError('WORKER_CRASH');
  return response.stdout;
}
