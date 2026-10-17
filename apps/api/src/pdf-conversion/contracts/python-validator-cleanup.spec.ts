import { spawn } from 'node:child_process';
import { startValidator } from './semantic-validator-test-fixture';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

describe('Python bridge settlement and cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(spawn).mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it.each([
    [Object.assign(new Error('PRIVATE_SPAWN'), { code: 'EACCES' }), 'EACCES'],
    ['synthetic non-Error rejection', null],
    [null, null],
    [undefined, null],
  ])(
    'preserves synchronous spawn rejection identity without a timer',
    async (error, code) => {
      jest.mocked(spawn).mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- Test original non-Error rejection identity.
        throw error;
      });
      const { observer, promise } = startValidator();
      await expect(promise).rejects.toBe(error);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'SPAWN_ERROR',
          errorCode: code,
          spawnObserved: false,
        }),
      );
      expect(jest.getTimerCount()).toBe(0);
    },
  );
  it.each([
    [Object.assign(new Error('PRIVATE_STDIN'), { code: 'EPIPE' }), 'EPIPE'],
    ['synthetic non-Error rejection', null],
    [null, null],
    [undefined, null],
  ])(
    'cleans the child/timer on synchronous stdin rejection and preserves identity',
    async (error, code) => {
      const { child, observer, promise } = startValidator({
        configure: (c) =>
          c.stdin.end.mockImplementation(() => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error -- Test original non-Error rejection identity.
            throw error;
          }),
      });
      await expect(promise).rejects.toBe(error);
      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(15000);
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'STDIN_ERROR',
          errorCode: code,
          timerFired: false,
        }),
      );
    },
  );
  it('contains throwing/reentrant sinks and throwing kill without losing refusal', async () => {
    let emitLate: () => void = () => undefined;
    const observer = jest.fn(() => {
      emitLate();
      throw new Error('PRIVATE_SINK');
    });
    const { child, promise } = startValidator({
      observer,
      configure: (c) =>
        c.kill.mockImplementation(() => {
          throw new Error('PRIVATE_KILL');
        }),
    });
    emitLate = () => {
      child.emit('close', 0, null);
      child.stdout.emit('data', Buffer.alloc(2000));
    };
    child.emit(
      'error',
      Object.assign(new Error('PRIVATE_ERROR'), { code: 'ENOENT' }),
    );
    await expect(promise).rejects.toMatchObject({
      code: 'VALIDATOR_UNAVAILABLE',
    });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'SPAWN_ERROR', stdoutBytes: 0 }),
    );
  });
});
