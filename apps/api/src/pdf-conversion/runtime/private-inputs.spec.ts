import { lstat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { privateInputs } from './private-inputs';

describe('attempt-private read-only input mount', () => {
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
