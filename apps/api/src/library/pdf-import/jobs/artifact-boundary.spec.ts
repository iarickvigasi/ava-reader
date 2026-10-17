import type { WorkerResultV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-worker-result-1';
import { checksumBuffer } from '../../../shared/blob-utils';
import {
  snapshotArtifactBytes,
  validateArtifactBytes,
} from './result-artifacts';
import { stageArtifacts } from './stage-artifacts';
import { completePdfJob } from './complete';
import type { PrismaService } from '../../../prisma/prisma.service';
import { MAX_CONTRACT_BYTES } from '../../../pdf-conversion/contracts/parse-json';
const bytes = Buffer.from('authored');
const descriptor = (id: string) => ({
  id,
  path: 'result.json',
  role: 'DIAGNOSTIC',
  sha256: checksumBuffer(bytes),
  byte_length: bytes.length,
  media_type: 'application/json',
});
const result = (id: string) =>
  ({
    outcome: { status: 'failed', diagnostic: descriptor(id) },
  }) as WorkerResultV1;
it('snapshots artifacts and rejects duplicates or content mismatches', () => {
  const input = [{ id: 'one', bytes: Buffer.from(bytes) }],
    copy = snapshotArtifactBytes(input);
  input[0].bytes.fill(0);
  expect(copy[0].bytes).toEqual(bytes);
  expect(() => snapshotArtifactBytes([...copy, ...copy])).toThrow();
  expect(() => validateArtifactBytes(result('one'), input)).toThrow();
  expect(() => validateArtifactBytes(result('other'), copy)).toThrow();
  expect(() => validateArtifactBytes(result('one'), copy)).not.toThrow();
});
it.each(['__proto__', 'constructor'])(
  'retains exact descriptor ID %s without prototype mutation',
  async (id) => {
    const create = jest
      .fn<Promise<{ id: string }>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({ id: 'database-minted' });
    const prisma = { pdfArtifact: { create } } as unknown as PrismaService;
    const map = await stageArtifacts(prisma, 'owner', result(id), [
      { id, bytes },
    ]);
    expect(Object.hasOwn(map, id)).toBe(true);
    expect(map[id]).toBe('database-minted');
    expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
    expect(create.mock.calls[0][0].data).toMatchObject({
      retention: 'STAGING',
    });
    expect(create.mock.calls[0][0].data.operation).toBeUndefined();
  },
);
it('rejects oversized completion before cloning or database access', async () => {
  const clone = jest.spyOn(Buffer, 'from');
  await expect(
    completePdfJob({} as PrismaService, {
      authority: {} as never,
      completion: { exitCode: 2, bytes: Buffer.alloc(MAX_CONTRACT_BYTES + 1) },
      artifacts: [],
      semantic: () => Promise.resolve(true),
    }),
  ).rejects.toThrow('PDF_JOB_RESULT_LIMIT');
  expect(clone).not.toHaveBeenCalled();
  clone.mockRestore();
});
