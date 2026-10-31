import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { narrationErrorName } from './narration-error-name';
const logger = new Logger('Narration');
export function narrationFailure(
  stage: string,
  error: unknown,
  status?: number,
) {
  if (status === undefined && error instanceof ServiceUnavailableException) {
    const detail = error.getResponse();
    if (
      typeof detail === 'object' &&
      'upstreamStatus' in detail &&
      typeof detail.upstreamStatus === 'number'
    )
      status = detail.upstreamStatus;
  }
  const cause = narrationErrorName(error);
  // Deliberately exclude selection, credentials and upstream response bodies.
  logger.warn(
    JSON.stringify({
      event: 'narration_failed',
      stage,
      cause,
      upstreamStatus: status,
    }),
  );
  return new ServiceUnavailableException({
    code:
      cause === 'TimeoutError'
        ? 'NARRATION_TIMEOUT'
        : 'NARRATION_PROVIDER_FAILED',
    message: 'Narration service could not prepare audio. Please try again.',
  });
}
