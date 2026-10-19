import { importOutput, InvalidImportedEpub } from './import-output';
const refusal = (code: string) =>
  Buffer.from(
    JSON.stringify({ schema_version: 'ava-epub-import-error-1', code }) + '\n',
  );
describe('isolated EPUB import receipt', () => {
  it('preserves a bounded deterministic refusal across transport chunks', async () => {
    const output = importOutput(new Map());
    const bytes = refusal('INVALID_EPUB');
    await output.write(bytes.subarray(0, 11));
    await output.write(bytes.subarray(11));
    expect(() => output.finish(1)).toThrow(InvalidImportedEpub);
  });
  it('infrastructure failure remains retryable', async () => {
    const output = importOutput(new Map());
    await output.write(refusal('VALIDATOR_UNAVAILABLE'));
    expect(() => output.finish(1)).toThrow('EPUB_VALIDATOR_UNAVAILABLE');
  });
  it('rejects contradictory exit and appended output', async () => {
    const output = importOutput(new Map());
    await output.write(refusal('INVALID_EPUB'));
    expect(() => output.finish(0)).toThrow('EPUB_VALIDATOR_UNAVAILABLE');
    await expect(output.write(Buffer.from('more'))).rejects.toThrow(
      'INVALID_RECEIPT',
    );
  });
  it('rejects reconstruction stream in the import channel', async () => {
    const output = importOutput(new Map());
    await expect(
      output.write(
        Buffer.from(
          JSON.stringify({
            schema_version: 'ava-reconstruct-stream-1',
            report: {},
            artifacts: [],
          }) + '\n',
        ),
      ),
    ).rejects.toThrow();
  });
});
