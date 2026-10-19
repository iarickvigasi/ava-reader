import type { SandboxInput } from './container-arguments';
import type { ExchangeEnvelope } from './exchange-protocol';

export const envelope = (
  sequence = 1,
  kind: ExchangeEnvelope['kind'] = 'page',
): ExchangeEnvelope => ({
  schema_version: 'ava-reconstruction-exchange-1',
  sequence,
  source_sha256: 'a'.repeat(64),
  profile_id: 'ava-pdf-prose-en-v2',
  kind,
  payload:
    kind === 'artifacts'
      ? null
      : kind === 'page' || kind === 'refinement_batch'
        ? { tasks: [] }
        : kind === 'recognition' || kind === 'refinement'
          ? { task_id: 'task-1' }
          : {},
});
export const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
export function frame(value: unknown) {
  const bytes = encode(value),
    header = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  return Buffer.concat([header, bytes]);
}
export function exchangeInput(): SandboxInput {
  return {
    module: 'ava_pdf_epub.reconstruction_v2',
    source: Buffer.from('source'),
    deadlineMs: 1000,
    scratchBytes: 67108864,
    jobBytes: encode({
      source: { sha256: envelope().source_sha256 },
      profile_id: envelope().profile_id,
    }),
    auxiliaryBytes: encode({
      mode: 'attempt_stream',
      input: {
        schema_version: 'ava-reconstruct-input-1',
        profile_id: envelope().profile_id,
        source_sha256: envelope().source_sha256,
        responses: [],
        refinements: [],
      },
    }),
    onExchange: (bytes) => {
      const request = JSON.parse(bytes.toString()) as ExchangeEnvelope;
      return Promise.resolve(
        request.kind === 'artifacts' || request.kind === 'refusal'
          ? Buffer.alloc(0)
          : encode({
              ...request,
              payload:
                request.kind === 'recognition' || request.kind === 'refinement'
                  ? [{}]
                  : [],
            }),
      );
    },
    onStdout: () => Promise.resolve(),
  };
}
