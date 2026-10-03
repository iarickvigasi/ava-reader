import { importReportSchema } from './import-report';
import { importOutput } from './import-output';
import { runSandbox } from '../../pdf-conversion/runtime/run-sandbox';
import type { PdfRuntimeConfig } from '../../pdf-conversion/runtime/runtime-config';
import { validateContract } from '../../pdf-conversion/contracts/validate-contract';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
import { checksumBuffer } from '../../shared/blob-utils';
export async function prepareCanonicalEpub(input: {
  bytes: Buffer;
  finalContentId: string;
  runtime: PdfRuntimeConfig;
  semantic: SemanticValidator;
  signal?: AbortSignal;
  remainingMs?: () => number;
}) {
  const artifacts = new Map<string, Buffer>();
  const stream = importOutput(artifacts);
  const sourceSha256 = checksumBuffer(input.bytes);
  const result = await runSandbox(
    {
      source: input.bytes,
      module: 'ava_pdf_epub.runtime.import_epub',
      jobBytes: Buffer.from(
        JSON.stringify({
          source_sha256: sourceSha256,
          final_content_id: input.finalContentId,
        }),
      ),
      deadlineMs: 180000,
      scratchBytes: 1073741824,
      signal: input.signal,
      leaseRemainingMs: input.remainingMs,
      onStdout: (bytes) => stream.write(bytes),
    },
    input.runtime,
  );
  const header = stream.finish(result.exitCode),
    report = importReportSchema.parse(header.report);
  const readerBytes = artifacts.get('reader.json')!;
  const reader = await validateContract(
    'ava-reader-3',
    readerBytes,
    input.semantic,
  );
  const canonical = await validateContract(
    'ava-book-2',
    artifacts.get('canonical.json')!,
    input.semantic,
  );
  if (
    report.source_sha256 !== sourceSha256 ||
    report.final_content_id !== input.finalContentId ||
    reader.final_content_id !== input.finalContentId ||
    reader.canonical_sha256 !== report.canonical_sha256 ||
    JSON.stringify(reader.book) !== JSON.stringify(canonical) ||
    JSON.stringify(reader.required_capabilities) !==
      JSON.stringify(report.required_capabilities) ||
    JSON.stringify(report) !==
      JSON.stringify(
        JSON.parse(artifacts.get('import-report.json')!.toString('utf8')),
      )
  )
    throw new Error('EPUB_PREPARATION_FAILED');
  const expected = new Set([
    'canonical.json',
    'reader.json',
    'import-report.json',
  ]);
  for (const resource of canonical.resources) {
    const path = `resources/${resource.sha256}`,
      bytes = artifacts.get(path);
    if (
      !bytes ||
      bytes.length !== resource.byte_length ||
      checksumBuffer(bytes) !== resource.sha256
    )
      throw new Error('EPUB_PREPARATION_FAILED');
    expected.add(path);
  }
  if (expected.size !== artifacts.size)
    throw new Error('EPUB_PREPARATION_FAILED');
  return { reader, readerBytes, report, artifacts };
}
export type PreparedCanonicalEpub = Awaited<
  ReturnType<typeof prepareCanonicalEpub>
>;
