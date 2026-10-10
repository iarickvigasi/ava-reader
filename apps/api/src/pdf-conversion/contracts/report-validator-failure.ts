import type { ContractName } from './types';
import type {
  ValidatorFailure,
  ValidatorFailureObserver,
} from './validator-failure.types';

const ERROR_CODES = [
  'ENOENT',
  'EACCES',
  'ENOEXEC',
  'EINVAL',
  'EPIPE',
  'ECONNRESET',
  'EBADF',
] as const;
const SIGNALS = [
  'SIGKILL',
  'SIGTERM',
  'SIGINT',
  'SIGHUP',
  'SIGABRT',
  'SIGSEGV',
  'SIGPIPE',
  'SIGBUS',
] as const;
const SCHEMAS: ContractName[] = [
  'ava-book-2',
  'ava-pdf-job-1',
  'ava-pdf-worker-result-1',
  'ava-accepted-content-1',
  'ava-reader-3',
];

// Explicit fields only: never pass a process Error, payload, path or raw output to logging.
export function reportValidatorFailure(
  observer: ValidatorFailureObserver | undefined,
  failure: Omit<ValidatorFailure, 'signal' | 'errorCode' | 'schema'> & {
    schema: ContractName | null;
    signal?: unknown;
    error?: unknown;
  },
) {
  let code: unknown = null;
  try {
    if (
      typeof failure.error === 'object' &&
      failure.error !== null &&
      'code' in failure.error
    )
      code = failure.error.code;
  } catch {
    code = 'OTHER';
  }
  try {
    observer?.({
      reason: failure.reason,
      schema: SCHEMAS.find((value) => value === failure.schema) ?? null,
      elapsedMs: failure.elapsedMs,
      inputBytes: failure.inputBytes,
      stdoutBytes: failure.stdoutBytes,
      timerFired: failure.timerFired,
      spawnObserved: failure.spawnObserved,
      closeObserved: failure.closeObserved,
      exitCode: failure.exitCode,
      signal:
        failure.signal == null
          ? null
          : (SIGNALS.find((value) => value === failure.signal) ?? 'OTHER'),
      errorCode:
        code === null
          ? null
          : (ERROR_CODES.find((value) => value === code) ?? 'OTHER'),
    });
  } catch {
    // Diagnostic sinks cannot change acceptance, refusal or cleanup.
  }
}
