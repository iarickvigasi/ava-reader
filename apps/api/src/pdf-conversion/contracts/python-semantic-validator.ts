import { isAbsolute } from 'node:path';
import { ContractError } from './contract-error';
import { reportValidatorFailure } from './report-validator-failure';
import { runPythonSemanticValidator } from './run-python-semantic-validator';
import type { SemanticValidator } from './types';
import type { ValidatorFailureObserver } from './validator-failure.types';

// Local isolated-worker bridge. Paths are deployment configuration, never request input.
export function pythonSemanticValidator(
  executable: string,
  observer?: ValidatorFailureObserver,
): SemanticValidator {
  if (!isAbsolute(executable)) {
    reportValidatorFailure(observer, {
      reason: 'INVALID_EXECUTABLE',
      schema: null,
      elapsedMs: 0,
      inputBytes: 0,
      stdoutBytes: 0,
      timerFired: false,
      spawnObserved: false,
      closeObserved: false,
      exitCode: null,
    });
    throw new ContractError('VALIDATOR_UNAVAILABLE');
  }
  return (schema, _payload, wireJson) =>
    runPythonSemanticValidator({ executable, observer, schema, wireJson });
}
