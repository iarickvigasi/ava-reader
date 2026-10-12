import type { SandboxInput } from './container-arguments';
import type { workerStderr } from './worker-stderr';
import {
  parseWorkerObservation,
  type WorkerObservationResult,
} from './worker-observation';

export type ObservationContext = Pick<
  SandboxInput,
  'observationBinding' | 'observationCommand'
>;
export function commandObservation(
  collected: Partial<
    Pick<
      ReturnType<ReturnType<typeof workerStderr>['finish']>,
      'observationStderr' | 'observationMalformed'
    >
  >,
  context?: ObservationContext,
): WorkerObservationResult {
  if (!context?.observationBinding || !context.observationCommand)
    return { status: 'UNOBSERVED', reason: 'UNAVAILABLE' };
  if (collected.observationMalformed)
    return { status: 'UNOBSERVED', reason: 'MALFORMED' };
  return parseWorkerObservation(
    collected.observationStderr,
    context.observationBinding,
    context.observationCommand,
  );
}
