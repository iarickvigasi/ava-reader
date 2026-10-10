import { spawn } from 'node:child_process';
import type { SandboxInput } from './container-arguments';
import type { PdfRuntimeConfig } from './runtime-config';
import type { dockerStream } from './docker-stream';
import { exchangeStream } from './exchange-stream';
import { ExchangeFailure } from './exchange-failure';
import { PdfRuntimeError } from './runtime-error';
import { workerStderr } from './worker-stderr';
import { writeExchangeReply } from './write-exchange-reply';
import { exchangeEntry } from './exchange-entry';

export function dockerExchange(
  config: PdfRuntimeConfig,
  name: string,
  input: SandboxInput,
  timeoutMs: number,
  signal: AbortSignal,
): ReturnType<typeof dockerStream> {
  return new Promise((resolve, reject) => {
    if (signal.aborted || !exchangeEntry(input)) {
      reject(new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED'));
      return;
    }
    const child = spawn(
      config.docker,
      ['--host', config.dockerHost, 'start', '--attach', '--interactive', name],
      {
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          LANG: 'C.UTF-8',
          PATH: '/usr/bin:/bin',
          DOCKER_CONFIG: '/dev/null',
        },
      },
    );
    const controller = new AbortController(),
      errors = workerStderr(Boolean(input.observationBinding));
    let settled = false,
      inputClosed = false;
    let pending = Promise.resolve();
    const finish = (failure?: unknown, code: number | null = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      const collected = errors.finish();
      if (collected.exhausted && failure === undefined)
        failure = new PdfRuntimeError('RESOURCE_LIMIT');
      controller.abort();
      child.stdin.destroy();
      if (failure !== undefined) {
        child.kill('SIGKILL');
        reject(
          failure instanceof ExchangeFailure ||
            failure instanceof PdfRuntimeError
            ? failure
            : new PdfRuntimeError('INVALID_RESULT'),
        );
      } else resolve({ exitCode: code, stdout: Buffer.alloc(0), ...collected });
    };
    const abort = () => finish(new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED'));
    const timer = setTimeout(
      () => finish(new PdfRuntimeError('EXECUTION_TIMEOUT')),
      timeoutMs,
    );
    const stream = exchangeStream(
      input,
      controller.signal,
      async (frame, last) => {
        if (frame.length)
          await writeExchangeReply(child.stdin, frame, controller.signal);
        if (controller.signal.aborted) return;
        if (last) {
          inputClosed = true;
          child.stdin.end();
        }
      },
      () => child.stdout.pause(),
    );
    signal.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish(new PdfRuntimeError('WORKER_CRASH')));
    child.stdin.on('error', () => finish(new PdfRuntimeError('WORKER_CRASH')));
    child.stdout.on('error', () => finish(new PdfRuntimeError('WORKER_CRASH')));
    child.stderr.on('error', () => finish(new PdfRuntimeError('WORKER_CRASH')));
    child.stdin.on('close', () => {
      if (!inputClosed && !settled && !stream.refusal)
        finish(new PdfRuntimeError('WORKER_CRASH'));
    });
    child.stdout.on('data', (data: Buffer) => {
      if (settled) return;
      pending = stream
        .write(data)
        .then(() => {
          if (!settled) child.stdout.resume();
        })
        .catch((error: unknown) => finish(error));
    });
    child.stderr.on('data', (data: Buffer) => {
      if (!errors.append(data)) finish(new PdfRuntimeError('RESOURCE_LIMIT'));
    });
    child.stdout.on('end', () => {
      if (!stream.artifacts && !stream.refusal)
        finish(new PdfRuntimeError('WORKER_CRASH'));
    });
    child.stdout.on('close', () => {
      if (!child.stdout.readableEnded || (!stream.artifacts && !stream.refusal))
        finish(new PdfRuntimeError('WORKER_CRASH'));
    });
    child.on('close', (code) => {
      if (code === 137 || code === 152) {
        finish(undefined, code);
        return;
      }
      if (stream.waiting && !stream.artifacts && !stream.refusal) {
        finish(new PdfRuntimeError('WORKER_CRASH'));
        return;
      }
      void pending.then(() => {
        if (settled) return;
        try {
          stream.finish(code);
          finish(undefined, code);
        } catch (error) {
          finish(error);
        }
      });
    });
    if (signal.aborted) abort();
  });
}
