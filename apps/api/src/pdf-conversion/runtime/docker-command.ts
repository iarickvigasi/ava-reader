import { spawn } from 'node:child_process';
import type { PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError, type RuntimeFailure } from './runtime-error';
import {
  faultAcknowledgement,
  type FaultExpectation,
} from './fault-acknowledgement';

export function dockerCommand(
  config: PdfRuntimeConfig,
  args: string[],
  timeoutMs: number,
  maxBytes: number,
  signal?: AbortSignal,
  expectedFault?: FaultExpectation,
) {
  return new Promise<{
    exitCode: number | null;
    stdout: Buffer;
    stderr: string;
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
    const chunks: Buffer[] = [];
    let bytes = 0,
      errors = '',
      errorBytes = 0,
      settled = false;
    const finish = (
      failure?: RuntimeFailure,
      exitCode: number | null = null,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (failure) {
        child.kill('SIGKILL');
        reject(
          new PdfRuntimeError(
            failure,
            faultAcknowledgement(errors, expectedFault),
          ),
        );
      } else
        resolve({ exitCode, stdout: Buffer.concat(chunks), stderr: errors });
    };
    const abort = () => finish('DISPATCH_NOT_AUTHORIZED');
    const timer = setTimeout(() => finish('EXECUTION_TIMEOUT'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish('WORKER_CRASH'));
    child.stdout.on('data', (data: Buffer) => {
      bytes += data.length;
      if (bytes > maxBytes) finish('RESOURCE_LIMIT');
      else chunks.push(data);
    });
    child.stderr.on('data', (data: Buffer) => {
      errorBytes += data.length;
      if (errorBytes > 8192) finish('RESOURCE_LIMIT');
      else errors += data.toString('utf8');
    });
    child.on('close', (code) => finish(undefined, code));
    if (signal?.aborted) abort();
  });
}
