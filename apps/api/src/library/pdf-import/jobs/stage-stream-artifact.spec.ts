import { requireAttempt } from './authority';
import { checksumBuffer } from '../../../shared/blob-utils';
import { JobAuthorityError } from './errors';
import { stagePdfStreamArtifact } from './stage-stream-artifact';
import {
  authority,
  bytes,
  png,
  checksum,
  descriptor,
  fixture,
} from './stage-stream-artifact-test-fixture';
jest.mock('./authority');
jest.mock('./transaction');
beforeEach(() => jest.resetAllMocks());

it.each(['png', 'jpg', 'jpeg'])(
  'stages images hash.%s with owned RESOURCE MIME',
  async (extension) => {
    const { prisma, create } = fixture();
    const content = extension === 'png' ? png : bytes;
    const checksum = checksumBuffer(content);
    const path = `images/${checksum}.${extension}`;
    expect(
      await stagePdfStreamArtifact(
        prisma,
        authority,
        descriptor(path, content),
        content,
      ),
    ).toBe('database-minted-resource');
    expect(requireAttempt).toHaveBeenCalledWith({}, authority);
    expect(create).toHaveBeenCalledTimes(1);
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    expect(create.mock.calls[0][0].data).toMatchObject({
      owner: { connect: { id: 'qualified-owner' } },
      role: 'RESOURCE',
      retention: 'STAGING',
      checksum,
      sizeBytes: content.length,
      mimeType,
      blob: {
        create: {
          purpose: 'PDF_ARTIFACT',
          checksum,
          sizeBytes: content.length,
          mimeType,
          originalFilename: `${checksum}.${extension}`,
          bytes: content,
        },
      },
    });
  },
);

it.each([
  `images/${checksum}.gif`,
  `images/${checksum.slice(1)}.jpg`,
  `images/${checksum}0.jpeg`,
  `images/${checksum.toUpperCase()}.jpg`,
  `other/${checksum}.jpg`,
  `images/../${checksum}.jpg`,
])('refuses resource namespace/type %s before storage', async (path) => {
  const { prisma, create } = fixture();
  await expect(
    stagePdfStreamArtifact(prisma, authority, descriptor(path), bytes),
  ).rejects.toThrow('PDF_JOB_ARTIFACT_INVALID');
  expect(create).not.toHaveBeenCalled();
});

it.each(['hash', 'length'])(
  'refuses a JPEG %s mismatch without storage',
  async (field) => {
    const { prisma, create } = fixture();
    const input = descriptor(`images/${checksum}.jpg`);
    const content = Buffer.from(bytes);
    if (field === 'hash') content[content.length - 1] ^= 0xff;
    else input.byte_length += 1;
    await expect(
      stagePdfStreamArtifact(prisma, authority, input, content),
    ).rejects.toThrow('PDF_JOB_ARTIFACT_INVALID');
    expect(create).not.toHaveBeenCalled();
  },
);

it('withholds a resource when attempt authority rejects', async () => {
  const { prisma, create } = fixture();
  jest.mocked(requireAttempt).mockRejectedValue(new JobAuthorityError());
  await expect(
    stagePdfStreamArtifact(
      prisma,
      authority,
      descriptor(`images/${checksum}.jpeg`),
      bytes,
    ),
  ).rejects.toBeInstanceOf(JobAuthorityError);
  expect(create).not.toHaveBeenCalled();
});
