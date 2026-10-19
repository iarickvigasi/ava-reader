import type { ContractName } from './types';

export type ValidatorFailureReason =
  | 'INVALID_EXECUTABLE'
  | 'INPUT_LIMIT'
  | 'DEADLINE'
  | 'SPAWN_ERROR'
  | 'STDIN_ERROR'
  | 'OUTPUT_LIMIT'
  | 'INVALID_PROTOCOL'
  | 'UNEXPECTED_EXIT';
export type ValidatorFailure = {
  reason: ValidatorFailureReason;
  schema: ContractName | null;
  elapsedMs: number;
  inputBytes: number;
  stdoutBytes: number;
  timerFired: boolean;
  spawnObserved: boolean;
  closeObserved: boolean;
  exitCode: number | null;
  signal:
    | 'SIGKILL'
    | 'SIGTERM'
    | 'SIGINT'
    | 'SIGHUP'
    | 'SIGABRT'
    | 'SIGSEGV'
    | 'SIGPIPE'
    | 'SIGBUS'
    | 'OTHER'
    | null;
  errorCode:
    | 'ENOENT'
    | 'EACCES'
    | 'ENOEXEC'
    | 'EINVAL'
    | 'EPIPE'
    | 'ECONNRESET'
    | 'EBADF'
    | 'OTHER'
    | null;
};
export type ValidatorFailureObserver = (failure: ValidatorFailure) => void;
export type ValidatorFailureContext = {
  reason: ValidatorFailureReason;
  error?: unknown;
  rejection?: unknown; // Preserve the original synchronous rejection value.
  timerFired?: boolean;
  closeObserved?: boolean;
  exitCode?: number | null;
  signal?: unknown;
};
export type ValidatorInvocation = {
  executable: string;
  observer?: ValidatorFailureObserver;
  schema: ContractName;
  wireJson: string;
};
