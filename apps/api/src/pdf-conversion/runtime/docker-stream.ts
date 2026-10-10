import { spawn } from 'node:child_process';
import type { PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError, type RuntimeFailure } from './runtime-error';
import { workerStderr } from './worker-stderr';
// Pause the pipe while a bounded artifact chunk is verified/persisted by the host.
export function dockerStream(
  config: PdfRuntimeConfig,
  args: string[],
  timeoutMs: number,
  consume: (chunk: Buffer) => Promise<void>,
  signal: AbortSignal,
  observeWorker = false,
) {
  return new Promise<{
    exitCode: number | null;
    stdout: Buffer;
    stderr: string;
    observationStderr?: string;
    observationMalformed?: boolean;
  }>((resolve, reject) => {
    const child = spawn(config.docker, ['--host', config.dockerHost, ...args], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        LANG: 'C.UTF-8',
        PATH: '/usr/bin:/bin',
        DOCKER_CONFIG: '/dev/null',
      },
    });
    const errors = workerStderr(observeWorker);
    let settled = false,
      bytes = 0;
    let pending = Promise.resolve();
    const finish = (
      failure?: RuntimeFailure,
      exitCode: number | null = null,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      const collected = errors.finish();
      failure ??= collected.exhausted ? 'RESOURCE_LIMIT' : undefined;
      if (failure) {
        child.kill('SIGKILL');
        reject(new PdfRuntimeError(failure));
      } else resolve({ exitCode, stdout: Buffer.alloc(0), ...collected });
    };
    const abort = () => finish('DISPATCH_NOT_AUTHORIZED'),
      timer = setTimeout(() => finish('EXECUTION_TIMEOUT'), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish('WORKER_CRASH'));
    child.stdout.on('data', (data: Buffer) => {
      child.stdout.pause();
      bytes += data.length;
      if (bytes > 704 * 1024 ** 2) {
        finish('RESOURCE_LIMIT');
        return;
      }
      pending = pending
        .then(async () => {
          if (!settled) await consume(data);
        })
        .then(() => {
          if (!settled) child.stdout.resume();
        })
        .catch(() => finish('INVALID_RESULT'));
    });
    child.stderr.on('data', (data: Buffer) => {
      if (!errors.append(data)) finish('RESOURCE_LIMIT');
    });
    child.on('close', (code) => {
      void pending.then(() => finish(undefined, code));
    });
    if (signal.aborted) abort();
  });
}
