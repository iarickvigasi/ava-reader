import { spawn } from 'node:child_process';
import { startValidator } from './semantic-validator-test-fixture';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

describe('Python bridge failure classification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(spawn).mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it.each([
    ['', 0, 'INVALID_PROTOCOL'],
    ['null', 0, 'INVALID_PROTOCOL'],
    ['{"valid":"true"}', 0, 'INVALID_PROTOCOL'],
    ['{"valid":true}', 2, 'UNEXPECTED_EXIT'],
    ['{"valid":false}', 0, 'UNEXPECTED_EXIT'],
  ])('classifies protocol/exit pair %s/%s', async (output, code, reason) => {
    const { child, observer, promise } = startValidator();
    child.stdout.emit('data', Buffer.from(output));
    child.emit('close', code, 'SIGTERM');
    await expect(promise).rejects.toMatchObject({
      code: 'VALIDATOR_UNAVAILABLE',
    });
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({
        reason,
        exitCode: code,
        signal: 'SIGTERM',
        closeObserved: true,
        timerFired: false,
        spawnObserved: true,
      }),
    );
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('keeps the exact deadline and its first cause despite late error/output/close', async () => {
    const { child, observer, promise } = startValidator();
    jest.advanceTimersByTime(14999);
    expect(observer).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    child.emit(
      'error',
      Object.assign(new Error('PRIVATE_ERROR'), { code: 'ENOENT' }),
    );
    child.stdout.emit('data', Buffer.alloc(2000));
    child.emit('close', null, 'SIGKILL');
    await expect(promise).rejects.toMatchObject({
      code: 'VALIDATOR_UNAVAILABLE',
    });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'DEADLINE',
        elapsedMs: 15000,
        stdoutBytes: 0,
        timerFired: true,
        closeObserved: false,
        exitCode: null,
        signal: null,
      }),
    );
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['child', 'stdin'] as const)(
    'classifies %s error without leaking it',
    async (target) => {
      const { child, observer, promise } = startValidator();
      const source = target === 'child' ? child : child.stdin;
      source.emit(
        'error',
        Object.assign(new Error('PRIVATE_ERROR /private/path'), {
          code: target === 'child' ? 'ENOENT' : 'PRIVATE_CODE',
        }),
      );
      child.emit('close', 1, null);
      await expect(promise).rejects.toMatchObject({
        code: 'VALIDATOR_UNAVAILABLE',
      });
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: target === 'child' ? 'SPAWN_ERROR' : 'STDIN_ERROR',
          errorCode: target === 'child' ? 'ENOENT' : 'OTHER',
          closeObserved: false,
        }),
      );
      expect(JSON.stringify((observer as jest.Mock).mock.calls)).not.toMatch(
        /PRIVATE|\/private/,
      );
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
