import { createHash } from 'node:crypto';
import { artifactStream } from './artifact-stream';
const data = Buffer.from('source bytes'),
  sha = createHash('sha256').update(data).digest('hex');
const descriptors = [
  'canonical.json',
  'book.epub',
  'reconstruction-report.json',
].map((path) => ({ path, sha256: sha, byte_length: data.length }));
function lines() {
  return [
    JSON.stringify({
      schema_version: 'ava-reconstruct-stream-1',
      report: {},
      artifacts: descriptors,
    }),
    ...descriptors.map((a) =>
      JSON.stringify({
        path: a.path,
        offset: 0,
        base64: data.toString('base64'),
      }),
    ),
    JSON.stringify({ complete: true }),
  ];
}
describe('bounded reconstruction artifact stream', () => {
  it('handles arbitrary pipe chunk boundaries without truncation', async () => {
    const found: string[] = [];
    const sink = artifactStream((d, b) => {
      found.push(d.path);
      expect(b).toEqual(data);
      return Promise.resolve();
    });
    const all = Buffer.from(lines().join('\n') + '\n');
    for (let n = 0; n < all.length; n += 7)
      await sink.write(all.subarray(n, n + 7));
    expect(sink.finish().artifacts).toEqual(descriptors);
    expect(found).toEqual(descriptors.map((a) => a.path));
  });
  it.each(['offset', 'hash', 'missing', 'extra'])(
    'rejects %s corruption',
    async (kind) => {
      const sink = artifactStream(async () => {}),
        records = lines();
      if (kind === 'offset')
        records[1] = JSON.stringify({
          path: 'canonical.json',
          offset: 1,
          base64: data.toString('base64'),
        });
      if (kind === 'hash')
        records[1] = JSON.stringify({
          path: 'canonical.json',
          offset: 0,
          base64: Buffer.from('different!!!').toString('base64'),
        });
      if (kind === 'missing') records.splice(2, 1);
      if (kind === 'extra') records.push('{}');
      await expect(
        sink.write(Buffer.from(records.join('\n') + '\n')),
      ).rejects.toThrow();
    },
  );
  it('requires completion before acceptance', async () => {
    const sink = artifactStream(async () => {});
    await sink.write(Buffer.from(lines().slice(0, -1).join('\n') + '\n'));
    expect(() => sink.finish()).toThrow();
  });
  it('refuses aggregate overflow before allocating bodies', async () => {
    const sink = artifactStream(async () => {});
    await expect(
      sink.write(
        Buffer.from(
          JSON.stringify({
            schema_version: 'ava-reconstruct-stream-1',
            report: {},
            artifacts: descriptors.map((a) => ({
              ...a,
              byte_length: 256 * 1024 ** 2,
            })),
          }) + '\n',
        ),
      ),
    ).rejects.toThrow();
  });
});
