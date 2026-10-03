import { containerArguments, type SandboxInput } from './container-arguments';
import { dockerStream } from './docker-stream';
import { dockerCommand } from './docker-command';
import { faultAcknowledgement } from './fault-acknowledgement';
import type { PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError } from './runtime-error';

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
  const result = input.onStdout
    ? await dockerStream(
        config,
        ['start', '--attach', name],
        remaining,
        input.onStdout,
        signal,
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
      );
  const acknowledgement = faultAcknowledgement(
    result.stderr,
    input.faultContext,
  );
  if (result.exitCode === 137 || result.exitCode === 152)
    throw new PdfRuntimeError('RESOURCE_LIMIT', acknowledgement);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    faultAcknowledged: acknowledgement !== undefined,
    faultAcknowledgement: acknowledgement,
  };
}
