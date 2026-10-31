import { Logger } from '@nestjs/common';
import { narrationErrorName } from '../narration-error-name';

const logger = new Logger('Narration');

// Decisions are idempotent and cheap; speech generation must not be replayed automatically.
export async function retryLanguageDecision<T>(
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load();
  } catch (error: unknown) {
    if (narrationErrorName(error) !== 'TimeoutError') throw error;
    logger.warn(
      JSON.stringify({
        event: 'narration_retry',
        stage: 'language',
        cause: 'TimeoutError',
        attempt: 2,
      }),
    );
    return load();
  }
}
