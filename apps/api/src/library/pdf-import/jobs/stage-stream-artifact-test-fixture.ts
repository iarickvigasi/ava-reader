import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer } from '../../../shared/blob-utils';
import { requireAttempt } from './authority';
import { jobTransaction } from './transaction';
import type { AttemptAuthority, Tx } from './types';

export const authority: AttemptAuthority = {
  principalId: 'worker',
  token: 'authored-worker-token',
  attemptId: 'attempt',
  attemptToken: 'authored-attempt-token',
};
// Authored one-pixel images; no supplied-book bytes enter this unit fixture.
export const bytes = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AP//Z',
  'base64',
);
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mNoAAAAggCB2kUIOwAAAABJRU5ErkJggg==',
  'base64',
);
export const checksum = checksumBuffer(bytes);
export const descriptor = (path: string, content = bytes) => ({
  path,
  sha256: checksumBuffer(content),
  byte_length: content.length,
});
export function fixture() {
  const create = jest
    .fn<Promise<{ id: string }>, [{ data: unknown }]>()
    .mockResolvedValue({ id: 'database-minted-resource' });
  jest.mocked(jobTransaction).mockImplementation((_, work) => work({} as Tx));
  jest.mocked(requireAttempt).mockResolvedValue({
    job: { owner_id: 'qualified-owner' },
  } as Awaited<ReturnType<typeof requireAttempt>>);
  return {
    create,
    prisma: { pdfArtifact: { create } } as unknown as PrismaService,
  };
}
