import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { loadAcceptedPdfReader } from './load-published-reader';
import { publishedPdfAuthority } from './published-authority';
import { selectionFixture } from './selection-fixture';

jest.mock('./published-authority');
const authorize = jest.mocked(publishedPdfAuthority);
function setup() {
  const fixture = selectionFixture();
  const authority = {
    op: fixture.authority.operation,
    publication: {
      acceptedBytes: fixture.acceptedBytes,
      acceptedSha256: fixture.authority.publication.acceptedSha256,
      publicationFence: fixture.authority.publication.fence,
    },
    qualification: fixture.authority.capability,
  } as unknown as Awaited<ReturnType<typeof publishedPdfAuthority>>;
  authorize.mockResolvedValue(authority);
  const artifact = jest.fn(() =>
    Promise.resolve({
      ...fixture.artifact,
      blob: { bytes: fixture.artifact.bytes },
    }),
  );
  const prisma = {
    pdfImportOperation: {
      findFirst: jest.fn(() => Promise.resolve(fixture.authority.operation)),
    },
    pdfArtifact: { findFirst: artifact },
  } as unknown as PrismaService;
  const semantic = Object.assign(
    jest.fn(() => Promise.resolve(true)),
    { validationIdentity: () => 'test-version' },
  );
  const run = () =>
    loadAcceptedPdfReader(
      prisma,
      {
        ...fixture.authority.viewer,
        schema: 'ava-reader-3',
        build: 'build',
      },
      semantic,
    );
  return { run, semantic, artifact, authority };
}
beforeEach(() => authorize.mockReset());
it('uses fresh authority before and after both cold and warm accepted selection', async () => {
  const { run, semantic } = setup();
  await run();
  await run();
  expect(authorize).toHaveBeenCalledTimes(4);
  expect(semantic).toHaveBeenCalledTimes(2);
});
it.each([new NotFoundException('deleted'), new ConflictException('revoked')])(
  'refuses deletion/revocation before a warm lookup: %s',
  async (error) => {
    const { run, artifact } = setup();
    await run();
    authorize.mockRejectedValueOnce(error);
    await expect(run()).rejects.toBe(error);
    expect(artifact).toHaveBeenCalledTimes(1);
  },
);
it.each([new NotFoundException('deleted'), new ConflictException('revoked')])(
  'refuses deletion/revocation during asynchronous warm selection: %s',
  async (error) => {
    const { run, authority, semantic } = setup();
    await run();
    authorize.mockResolvedValueOnce(authority).mockRejectedValueOnce(error);
    await expect(run()).rejects.toBe(error);
    expect(semantic).toHaveBeenCalledTimes(2);
  },
);
it('refuses deletion during cold semantic validation', async () => {
  const { run, authority, semantic } = setup();
  const deleted = new NotFoundException('deleted');
  authorize.mockResolvedValueOnce(authority).mockRejectedValueOnce(deleted);
  await expect(run()).rejects.toBe(deleted);
  expect(semantic).toHaveBeenCalledTimes(2);
});
