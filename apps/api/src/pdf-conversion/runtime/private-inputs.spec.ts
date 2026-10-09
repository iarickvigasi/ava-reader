import { lstat, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { privateInputs } from './private-inputs';
import type { WorkerBinding } from './worker-observation';
jest.mock('node:fs/promises', () => {
  const actual =
    jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, writeFile: jest.fn(actual.writeFile) };
});

describe('attempt-private read-only input mount', () => {
  afterEach(() => {
    jest
      .mocked(writeFile)
      .mockImplementation(
        jest.requireActual<typeof import('node:fs/promises')>(
          'node:fs/promises',
        ).writeFile,
      );
  });
  it('optional observation-file failure retains required source, request and live lease', async () => {
    const actual =
      jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
    jest
      .mocked(writeFile)
      .mockImplementation((path, ...args) =>
        typeof path === 'string' && path.endsWith('worker-observation.json')
          ? Promise.reject(new Error('synthetic observation write failure'))
          : actual.writeFile(path, ...args),
      );
    const source = Buffer.from('synthetic'),
      request = Buffer.from('{"mode":"prepare","page_number":1}');
    const input = await privateInputs(
      {
        source,
        jobBytes: Buffer.from('{}'),
        auxiliaryBytes: request,
        module: 'ava_pdf_epub.reconstruction_v2',
        deadlineMs: 30000,
        scratchBytes: 1024,
        observationBinding: {
          job_id: 'job-fixture',
          attempt_id: 'attempt-fixture',
          unit_id: 'unit-fixture',
        } as WorkerBinding,
      },
      jest.fn(),
      'ava-pdf-observation-test',
    );
    try {
      expect(await readFile(join(input.directory, 'source.pdf'))).toEqual(
        source,
      );
      expect(
        await readFile(join(input.directory, 'reconstruction-request.json')),
      ).toEqual(request);
      await expect(
        readFile(join(input.directory, 'lease.json')),
      ).resolves.toBeDefined();
      await expect(
        lstat(join(input.directory, 'worker-observation.json')),
      ).rejects.toThrow();
    } finally {
      await input.cleanup();
    }
  });
  it('updates lease control atomically without copying credentials or granting a new lease', async () => {
    const deadline = performance.now() + 30000;
    const abort = jest.fn();
    const input = await privateInputs(
      {
        source: Buffer.from('synthetic'),
        module: 'ava_pdf_epub.runtime',
        deadlineMs: 30000,
        scratchBytes: 1024,
        leaseRemainingMs: () => deadline - performance.now(),
      },
      abort,
      'ava-pdf-00000000-0000-0000-0000-000000000000',
    );
    try {
      const first = JSON.parse(
        await readFile(join(input.directory, 'lease.json'), 'utf8'),
      ) as { sequence: number; remaining_ms: number };
      // Observe the completed atomic rename, not merely the refresh timer firing.
      const observationDeadline = performance.now() + 10000;
      let next = first;
      while (
        next.sequence <= first.sequence &&
        performance.now() < observationDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        next = JSON.parse(
          await readFile(join(input.directory, 'lease.json'), 'utf8'),
        ) as { sequence: number; remaining_ms: number };
      }
      expect(next.sequence).toBeGreaterThan(first.sequence);
      expect(next.remaining_ms).toBeLessThan(first.remaining_ms);
      expect((await lstat(dirname(input.directory))).mode & 0o777).toBe(0o700);
      expect(
        (await lstat(join(input.directory, 'source.pdf'))).mode & 0o777,
      ).toBe(0o444);
      expect(abort).not.toHaveBeenCalled();
    } finally {
      await input.cleanup();
    }
    await expect(lstat(input.directory)).rejects.toThrow();
  }, 15000);
});
