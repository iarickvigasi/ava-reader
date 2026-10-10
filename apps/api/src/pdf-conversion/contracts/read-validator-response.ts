import type { ValidatorFailureContext } from './validator-failure.types';

export function readValidatorResponse(
  output: string,
  code: number | null,
  signal: NodeJS.Signals | null,
): boolean | ValidatorFailureContext {
  const close = { closeObserved: true, exitCode: code, signal };
  try {
    const response = JSON.parse(output) as { valid?: unknown } | null;
    if (code === 0 && response?.valid === true) return true;
    if (code === 1 && response?.valid === false) return false;
    return {
      reason:
        typeof response?.valid === 'boolean'
          ? 'UNEXPECTED_EXIT'
          : 'INVALID_PROTOCOL',
      ...close,
    };
  } catch {
    return { reason: 'INVALID_PROTOCOL', ...close };
  }
}
