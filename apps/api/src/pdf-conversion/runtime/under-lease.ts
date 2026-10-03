import { PdfRuntimeError } from './runtime-error';

export function underLease<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted)
    return Promise.reject(new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED'));
    signal.addEventListener('abort', abort, { once: true });
    try {
      void operation()
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', abort));
    } catch (error) {
      signal.removeEventListener('abort', abort);
      reject(
        error instanceof Error ? error : new PdfRuntimeError('WORKER_CRASH'),
      );
    }
    if (signal.aborted) abort();
  });
}
