import { setTimeout as delay } from 'node:timers/promises';
import type { ImportContext } from './import-operation';
import { databaseErrorCode } from './database-error-code';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 1000;
const RETRYABLE_CODES = new Set(['57014', '40001', '40P01']);

export async function retryDatabaseOperation<T>(
  context: ImportContext,
  action: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      return await action();
    } catch (error) {
      const databaseCode = databaseErrorCode(error);
      const retry =
        attempt < MAX_ATTEMPTS && RETRYABLE_CODES.has(databaseCode ?? '');
      console.error(
        JSON.stringify({
          ...context,
          attempt,
          elapsedMs: Date.now() - started,
          databaseCode,
          retry,
        }),
      );
      if (!retry) throw error;
      await delay(BACKOFF_MS * attempt);
    }
  }
}
