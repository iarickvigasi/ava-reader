import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { digitalSource } from './digital-source';
import { loadDigitalBytes } from './load-digital-bytes';
import type { Candidate } from '../types';
jest.mock('./digital-source');
let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'digital-'));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});
it('never imports a source update or modified local file under a previously inspected hash', async () => {
  const bytes = Buffer.from('original bytes');
  const localFile = join(folder, 'book.epub');
  await writeFile(localFile, bytes);
  const candidate = {
    localFile,
    checksum: createHash('sha256').update(bytes).digest('hex'),
    downloadUrl: 'https://standardebooks.org/book.epub',
    inspectedAt: '2026-10-29',
  } as Candidate;
  jest
    .mocked(digitalSource)
    .mockResolvedValue({ bytes: Buffer.from('updated bytes') } as Awaited<
      ReturnType<typeof digitalSource>
    >);
  await expect(loadDigitalBytes(candidate)).rejects.toThrow('changed');
  jest
    .mocked(digitalSource)
    .mockResolvedValue({ bytes } as Awaited<ReturnType<typeof digitalSource>>);
  expect(await loadDigitalBytes(candidate)).toEqual(bytes);
  await writeFile(localFile, 'tampered');
  await expect(loadDigitalBytes(candidate)).rejects.toThrow('changed');
});
