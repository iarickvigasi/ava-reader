import { containerArguments, type SandboxInput } from './container-arguments';
import { dockerStream } from './docker-stream';
import { dockerCommand } from './docker-command';
import { dockerExchange } from './docker-exchange';
import { faultAcknowledgement } from './fault-acknowledgement';
import type { PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError } from './runtime-error';
import {
  parseWorkerObservation,
  type WorkerObservationResult,
} from './worker-observation';

export async function startContainer(
  config: PdfRuntimeConfig,
  input: SandboxInput,
  name: string,
  directory: string,
  signal: AbortSignal,
) {
  const started = performance.now();
  if (signal.aborted) throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const created = await dockerCommand(
    config,
    containerArguments(config, input, name, directory),
    15000,
    1024,
  );
  if (
    created.exitCode !== 0 ||
    !/^[a-f0-9]{64}\n?$/.test(created.stdout.toString())
  )
    throw new PdfRuntimeError('WORKER_CRASH');
  const remaining = input.deadlineMs - (performance.now() - started);
  if (remaining <= 0) throw new PdfRuntimeError('EXECUTION_TIMEOUT');
  const result = input.onExchange
    ? await dockerExchange(config, name, input, remaining, signal)
    : input.onStdout
      ? await dockerStream(
          config,
          ['start', '--attach', name],
          remaining,
          input.onStdout,
          signal,
          Boolean(input.observationBinding),
        )
      : await dockerCommand(
          config,
          ['start', '--attach', name],
          remaining,
          input.module.endsWith('.inspect')
            ? 4 * 1024 ** 2
            : input.module === 'ava_pdf_epub.reconstruction_v2'
              ? 64 * 1024 ** 2
              : 33 * 1024 ** 2,
          signal,
          input.faultContext,
          Boolean(input.observationBinding),
        );
  const acknowledgement = faultAcknowledgement(
    result.stderr,
    input.faultContext,
  );
  if (result.exitCode === 137 || result.exitCode === 152)
    throw new PdfRuntimeError('RESOURCE_LIMIT', acknowledgement);
  let workerObservation: WorkerObservationResult =
    !input.observationBinding || !input.observationCommand
      ? { status: 'UNOBSERVED', reason: 'UNAVAILABLE' }
      : result.observationMalformed
        ? { status: 'UNOBSERVED', reason: 'MALFORMED' }
        : parseWorkerObservation(
            result.observationStderr,
            input.observationBinding,
            input.observationCommand,
          );
  if (
    workerObservation.status === 'OBSERVED' &&
    (result.exitCode === 0) !==
      (workerObservation.packet.outcome === 'completed')
  )
    workerObservation = { status: 'UNOBSERVED', reason: 'MALFORMED' };
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    faultAcknowledged: acknowledgement !== undefined,
    faultAcknowledgement: acknowledgement,
    ...(input.observationBinding ? { workerObservation } : {}),
  };
}
