import { Logger } from '@nestjs/common';
import { pythonSemanticValidator } from '../../pdf-conversion/contracts/python-semantic-validator';
import { reportValidatorFailure } from '../../pdf-conversion/contracts/report-validator-failure';
import { readerSemanticValidator } from './semantic';

jest.mock('../../pdf-conversion/contracts/python-semantic-validator', () => ({
  pythonSemanticValidator: jest.fn(),
}));
const details = {
  reason: 'DEADLINE' as const,
  schema: 'ava-reader-3' as const,
  elapsedMs: 15000,
  inputBytes: 42,
  stdoutBytes: 0,
  timerFired: true,
  spawnObserved: true,
  closeObserved: false,
  exitCode: null,
};

describe('reader private diagnostic logging', () => {
  beforeEach(() => jest.mocked(pythonSemanticValidator).mockReset());
  afterEach(() => jest.restoreAllMocks());
  it.each([false, true])(
    'logs safe fields without changing503 when logger throws=%s',
    async (throwing) => {
      const warning = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {
          if (throwing) throw new Error('PRIVATE_LOGGER');
        });
      jest
        .mocked(pythonSemanticValidator)
        .mockImplementation((_path, observer) => () => {
          reportValidatorFailure(observer, details);
          return Promise.reject(new Error('PRIVATE_BRIDGE'));
        });
      await expect(
        readerSemanticValidator('ava-reader-3', null, 'PRIVATE_BODY'),
      ).rejects.toMatchObject({
        message: 'Reader validation is unavailable.',
        status: 503,
      });
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith({
        event: 'reader_validation_failed',
        ...details,
        signal: null,
        errorCode: null,
      });
      expect(JSON.stringify(warning.mock.calls)).not.toContain('PRIVATE');
      jest
        .mocked(pythonSemanticValidator)
        .mockReturnValue(() => Promise.resolve(false));
      await expect(
        readerSemanticValidator('ava-reader-3', null, '{}'),
      ).resolves.toBe(false);
      expect(warning).toHaveBeenCalledTimes(1);
    },
  );
});
