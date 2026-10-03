import { randomUUID } from 'node:crypto';
import { MAX_ACTIVE_DEADLINE_MS } from '../contracts/execution-limits';
import { privateInputs } from './private-inputs';
import type { SandboxInput } from './container-arguments';
import { dockerCommand } from './docker-command';
import { startContainer } from './start-container';
import { validateRuntimeConfig, type PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError } from './runtime-error';

export async function runSandbox(
  input: SandboxInput,
  settings: PdfRuntimeConfig,
) {
  const config = validateRuntimeConfig(settings);
  if (
    !Number.isSafeInteger(input.deadlineMs) ||
    input.deadlineMs < 1 ||
    input.deadlineMs > MAX_ACTIVE_DEADLINE_MS ||
    !Number.isSafeInteger(input.scratchBytes) ||
    input.scratchBytes < 1 ||
    input.scratchBytes > 2147483648 ||
    input.source.length < 1 ||
    input.source.length >
      (input.module.endsWith('.validate_epub') ? 268435456 : 52428800) ||
    (input.jobBytes?.length ?? 0) > 65536 ||
    (input.auxiliaryBytes?.length ?? 0) > 67108864 ||
    (input.auxiliaryBytes &&
      input.module !== 'ava_pdf_epub.reconstruction_v2') ||
    (input.onStdout &&
      ![
        'ava_pdf_epub.reconstruction_v2',
        'ava_pdf_epub.runtime.import_epub',
      ].includes(input.module)) ||
    ![
      'ava_pdf_epub.runtime',
      'ava_pdf_epub.runtime.inspect',
      'ava_pdf_epub.runtime.validate_epub',
      'ava_pdf_epub.runtime.import_epub',
      'ava_pdf_epub.reconstruction_v2',
    ].includes(input.module)
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const source = Buffer.from(input.source),
    jobBytes = input.jobBytes && Buffer.from(input.jobBytes),
    auxiliaryBytes = input.auxiliaryBytes && Buffer.from(input.auxiliaryBytes);
  const name = `ava-pdf-${randomUUID()}`;
  const failedLease = new AbortController();
  const signal = input.signal
    ? AbortSignal.any([input.signal, failedLease.signal])
    : failedLease.signal;
  const inputs = await privateInputs(
    { ...input, source, jobBytes, auxiliaryBytes },
    () => failedLease.abort(),
    name,
  );
  let response: Awaited<ReturnType<typeof startContainer>> | undefined;
  let failure: PdfRuntimeError | undefined;
  let cleanupFailed = false;
  try {
    response = await startContainer(
      config,
      input,
      name,
      inputs.directory,
      signal,
    );
  } catch (error) {
    failure =
      error instanceof PdfRuntimeError
        ? error
        : new PdfRuntimeError('WORKER_CRASH');
  } finally {
    // Removing the container stops its entire cgroup, including extractor grandchildren.
    const removed = await dockerCommand(
      config,
      ['rm', '--force', name],
      10000,
      1024,
    ).catch(() => null);
    const inputCleanup = await inputs.cleanup().then(
      () => true,
      () => false,
    );
    cleanupFailed =
      !inputCleanup ||
      !removed ||
      (removed.exitCode !== 0 && !removed.stderr.includes('No such container'));
  }
  if (failure)
    throw new PdfRuntimeError(
      failure.code,
      failure.faultAcknowledgement,
      cleanupFailed,
    );
  if (cleanupFailed || !response)
    throw new PdfRuntimeError('WORKER_CRASH', undefined, cleanupFailed);
  return response;
}
