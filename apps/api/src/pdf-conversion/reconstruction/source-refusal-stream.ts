import { PdfRuntimeError } from '../runtime/runtime-error';
import { parseSourceRefusal, type SourceContentError } from './source-refusal';

// A refusal is one bounded first-line packet. Candidate streams retain their existing parser.
export function sourceRefusalStream(
  sourceSha256: string,
  write: (chunk: Buffer) => Promise<void>,
) {
  let pending = Buffer.alloc(0),
    first = true,
    refusal: SourceContentError | undefined;
  return {
    async write(chunk: Buffer) {
      if (refusal) throw new PdfRuntimeError('INVALID_RESULT');
      if (!first) return write(chunk);
      pending = Buffer.concat([pending, chunk]);
      const end = pending.indexOf(10);
      if (pending.length > 4 * 1024 ** 2)
        throw new PdfRuntimeError('INVALID_RESULT');
      if (end < 0) return;
      const line = pending.subarray(0, end);
      let raw: unknown;
      try {
        raw = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(line),
        );
      } catch {
        throw new PdfRuntimeError('INVALID_RESULT');
      }
      if (
        raw &&
        typeof raw === 'object' &&
        'schema_version' in raw &&
        raw.schema_version === 'ava-source-refusal-1'
      ) {
        refusal = parseSourceRefusal(line, sourceSha256);
        if (pending.length !== end + 1)
          throw new PdfRuntimeError('INVALID_RESULT');
        pending = Buffer.alloc(0);
        return;
      }
      first = false;
      const bytes = pending;
      pending = Buffer.alloc(0);
      return write(bytes);
    },
    finish(exitCode: number | null) {
      if (refusal) {
        if (exitCode !== 1) throw new PdfRuntimeError('INVALID_RESULT');
        throw refusal;
      }
    },
  };
}
