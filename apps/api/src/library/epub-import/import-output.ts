import { artifactStream } from '../../pdf-conversion/runtime/artifact-stream';
export class InvalidImportedEpub extends Error {}
export function importOutput(artifacts: Map<string, Buffer>) {
  const stream = artifactStream((descriptor, bytes) => {
    artifacts.set(descriptor.path, bytes);
    return Promise.resolve();
  }, 'epub-import');
  let initial = Buffer.alloc(0),
    started = false,
    refusal: string | undefined;
  return {
    async write(bytes: Buffer) {
      if (refusal) throw new Error('EPUB_IMPORT_INVALID_RECEIPT');
      if (started) return stream.write(bytes);
      initial = Buffer.concat([initial, bytes]);
      const newline = initial.indexOf(10);
      if (newline < 0) {
        if (initial.length > 409600)
          throw new Error('EPUB_IMPORT_INVALID_RECEIPT');
        return;
      }
      const first: unknown = JSON.parse(
        initial.subarray(0, newline).toString('utf8'),
      );
      if (
        typeof first === 'object' &&
        first !== null &&
        'schema_version' in first &&
        first.schema_version === 'ava-epub-import-error-1'
      ) {
        if (
          !('code' in first) ||
          !['INVALID_EPUB', 'VALIDATOR_UNAVAILABLE'].includes(
            String(first.code),
          ) ||
          Object.keys(first).length !== 2 ||
          initial.length !== newline + 1
        )
          throw new Error('EPUB_IMPORT_INVALID_RECEIPT');
        refusal = String(first.code);
        return;
      }
      started = true;
      await stream.write(initial);
      initial = Buffer.alloc(0);
    },
    finish(exitCode: number | null) {
      if (refusal === 'INVALID_EPUB' && exitCode === 1)
        throw new InvalidImportedEpub(
          'The EPUB does not match its declared content.',
        );
      if (refusal || exitCode !== 0)
        throw new Error('EPUB_VALIDATOR_UNAVAILABLE');
      return stream.finish();
    },
  };
}
