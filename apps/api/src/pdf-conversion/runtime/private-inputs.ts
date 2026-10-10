import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SandboxInput } from './container-arguments';

export async function privateInputs(
  input: SandboxInput,
  abort: () => void,
  containerName: string,
) {
  const root = await mkdtemp(join(tmpdir(), 'ava-pdf-runtime-'));
  const directory = join(root, 'input');
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: Promise<void> | undefined;
  let sequence = 0;
  const deadline = performance.now() + input.deadlineMs;
  const refresh = async () => {
    const remaining = Math.min(
      30000,
      deadline - performance.now(),
      input.leaseRemainingMs?.() ?? Infinity,
    );
    if (!Number.isFinite(remaining)) throw new Error('Invalid lease');
    const lease = JSON.stringify({
      sequence: sequence++,
      remaining_ms: Math.max(0, Math.floor(remaining)),
    });
    await writeFile(join(directory, 'lease.next'), lease, { mode: 0o444 });
    await rename(join(directory, 'lease.next'), join(directory, 'lease.json'));
  };
  try {
    await writeFile(
      join(root, 'runtime.json'),
      JSON.stringify({
        version: 1,
        containerName,
        cleanupAfter: Date.now() + input.deadlineMs + 120000,
      }),
      { mode: 0o600, flag: 'wx' },
    );
    await mkdir(directory, { mode: 0o755 });
    await writeFile(join(directory, 'source.pdf'), input.source, {
      mode: 0o444,
      flag: 'wx',
    });
    if (input.jobBytes)
      await writeFile(join(directory, 'job.json'), input.jobBytes, {
        mode: 0o444,
        flag: 'wx',
      });
    if (input.auxiliaryBytes)
      await writeFile(
        join(directory, 'reconstruction-request.json'),
        input.auxiliaryBytes,
        { mode: 0o444, flag: 'wx' },
      );
    if (input.observationBinding)
      await writeFile(
        join(directory, 'worker-observation.json'),
        JSON.stringify({
          schema_version: 'ava-worker-observation-binding-1',
          job_id: input.observationBinding.job_id,
          attempt_id: input.observationBinding.attempt_id,
          unit_id: input.observationBinding.unit_id,
        }),
        { mode: 0o444, flag: 'wx' },
      ).catch(() => undefined);
    await refresh();
    timer = setInterval(() => {
      if (!pending)
        pending = refresh()
          .catch(abort)
          .finally(() => {
            pending = undefined;
          });
    }, 250);
    return {
      directory,
      async cleanup() {
        clearInterval(timer);
        await pending;
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    clearInterval(timer);
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
