import { reportValidatorFailure } from './report-validator-failure';
import type { ContractName } from './types';
import type { ValidatorFailure } from './validator-failure.types';

const base = {
  reason: 'SPAWN_ERROR' as const,
  schema: 'ava-reader-3' as const,
  elapsedMs: 12,
  inputBytes: 40,
  stdoutBytes: 0,
  timerFired: false,
  spawnObserved: false,
  closeObserved: false,
  exitCode: null,
};

describe('private validation diagnostic boundary', () => {
  it('emits only fixed fields and allowlisted metadata', () => {
    const observer = jest.fn<void, [ValidatorFailure]>();
    const error = Object.assign(new Error('PRIVATE_ERROR /private/path'), {
      code: 'PRIVATE_CODE',
      body: 'PRIVATE_BODY',
    });
    reportValidatorFailure(observer, {
      ...base,
      error,
      schema: 'PRIVATE_SCHEMA' as ContractName,
      signal: 'PRIVATE_SIGNAL',
    });
    expect(observer).toHaveBeenCalledWith({
      ...base,
      schema: null,
      signal: 'OTHER',
      errorCode: 'OTHER',
    });
    expect(JSON.stringify(observer.mock.calls)).not.toMatch(
      /PRIVATE|\/private/,
    );
    expect(Object.keys(observer.mock.calls[0][0] as object).sort()).toEqual(
      [
        'reason',
        'schema',
        'elapsedMs',
        'inputBytes',
        'stdoutBytes',
        'timerFired',
        'spawnObserved',
        'closeObserved',
        'exitCode',
        'signal',
        'errorCode',
      ].sort(),
    );
  });
  it('contains hostile code getters and diagnostic exceptions', () => {
    const observer = jest.fn(() => {
      throw new Error('PRIVATE_SINK');
    });
    const error = Object.defineProperty({}, 'code', {
      get: () => {
        throw new Error('PRIVATE_GETTER');
      },
    });
    expect(() =>
      reportValidatorFailure(observer, { ...base, error }),
    ).not.toThrow();
    expect(observer).toHaveBeenCalledWith({
      ...base,
      signal: null,
      errorCode: 'OTHER',
    });
  });
});
