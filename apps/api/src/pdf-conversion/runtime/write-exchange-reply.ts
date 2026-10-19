import type { Writable } from 'node:stream';
import { PdfRuntimeError } from './runtime-error';

export function writeExchangeReply(
  stream: Writable,
  frame: Buffer,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => done(new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED'));
    let settled = false;
    const done = (error?: Error | null) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve();
    };
    if (signal.aborted) return aborted();
    signal.addEventListener('abort', aborted, { once: true });
    try {
      stream.write(frame, done);
    } catch {
      done(new PdfRuntimeError('WORKER_CRASH'));
    }
  });
}
