import { artifactStream } from '../../../pdf-conversion/runtime/artifact-stream';
import { stagePdfStreamArtifact } from './stage-stream-artifact';
import {
  authority,
  bytes,
  checksum,
  descriptor,
  fixture,
} from './stage-stream-artifact-test-fixture';
jest.mock('./authority');
jest.mock('./transaction');
beforeEach(() => jest.resetAllMocks());

function wire(path: string, body = bytes) {
  const primary = ['canonical.json', 'book.epub', 'reconstruction-report.json'];
  const artifacts = [...primary, path].map((name) => descriptor(name));
  return Buffer.from(
    [
      JSON.stringify({
        schema_version: 'ava-reconstruct-stream-1',
        report: {},
        artifacts,
      }),
      ...artifacts.map((a) =>
        JSON.stringify({
          path: a.path,
          offset: 0,
          base64: (a.path === path ? body : bytes).toString('base64'),
        }),
      ),
      JSON.stringify({ complete: true }),
    ].join('\n') + '\n',
  );
}

it.each(['jpg', 'jpeg'])(
  'decodes then really stages the fourth %s resource',
  async (extension) => {
    const { prisma, create } = fixture();
    const path = `images/${checksum}.${extension}`;
    const stream = artifactStream(async (d, b) => {
      await stagePdfStreamArtifact(prisma, authority, d, b);
    });
    const data = wire(path);
    for (let offset = 0; offset < data.length; offset += 7)
      await stream.write(data.subarray(offset, offset + 7));
    expect(stream.finish().artifacts.at(-1)).toEqual(descriptor(path));
    expect(create).toHaveBeenCalledTimes(4);
    expect(create.mock.calls.map(([arg]) => arg.data)).toMatchObject([
      { role: 'CANONICAL_BOOK' },
      { role: 'DERIVED_EPUB' },
      { role: 'VALIDATION_REPORT' },
      {
        role: 'RESOURCE',
        mimeType: 'image/jpeg',
        checksum,
        sizeBytes: bytes.length,
        owner: { connect: { id: 'qualified-owner' } },
        blob: {
          create: {
            bytes,
            mimeType: 'image/jpeg',
            checksum,
            originalFilename: `${checksum}.${extension}`,
          },
        },
      },
    ]);
  },
);

it('rejects changed JPEG bytes before the resource reaches storage', async () => {
  const { prisma, create } = fixture();
  const stream = artifactStream(async (d, b) => {
    await stagePdfStreamArtifact(prisma, authority, d, b);
  });
  const corrupt = Buffer.from(bytes);
  corrupt[corrupt.length - 1] ^= 0xff;
  await expect(
    stream.write(wire(`images/${checksum}.jpg`, corrupt)),
  ).rejects.toThrow('INVALID_RESULT');
  expect(create).toHaveBeenCalledTimes(3);
  expect(() => stream.finish()).toThrow('INVALID_RESULT');
});

it.each([`images/${checksum}.svg`, `other/${checksum}.jpg`])(
  'rejects unsupported header namespace %s before any staging',
  async (path) => {
    const { prisma, create } = fixture();
    const stream = artifactStream(async (d, b) => {
      await stagePdfStreamArtifact(prisma, authority, d, b);
    });
    await expect(stream.write(wire(path))).rejects.toThrow('INVALID_RESULT');
    expect(create).not.toHaveBeenCalled();
  },
);
