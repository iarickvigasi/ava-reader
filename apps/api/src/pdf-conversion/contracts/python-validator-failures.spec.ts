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
  it('keeps the 15-second deadline at exactly one MiB including the envelope', async () => {
    const envelope = Buffer.byteLength(
      '{"schema_version":"ava-reader-3","payload":}',
    );
    const { child, observer, promise } = startValidator({
      wire: JSON.stringify({
        body: 'x'.repeat(1024 * 1024 - envelope - '{"body":""}'.length),
      }),
    });
    const outcome = promise.catch((error: unknown) => error);
    jest.advanceTimersByTime(14999);
    expect(observer).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await expect(outcome).resolves.toMatchObject({
      code: 'VALIDATOR_UNAVAILABLE',
    });
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'DEADLINE',
        inputBytes: 1024 * 1024,
        elapsedMs: 15000,
      }),
    );
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each([
    [0, true],
    [1, false],
  ] as const)(
    'retains a large validation outcome %s/%s arriving after 30 seconds',
    async (code, valid) => {
      const { child, observer, promise } = startValidator({
        wire: JSON.stringify({ body: 'x'.repeat(28 * 1024 * 1024) }),
      });
      const outcome = promise.catch((error: unknown) => error);
      jest.advanceTimersByTime(30000);
      child.stdout.emit('data', Buffer.from(JSON.stringify({ valid })));
      child.emit('close', code, null);
      await expect(outcome).resolves.toBe(valid);
      expect(observer).not.toHaveBeenCalled();
      expect(child.kill).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    },
  );
  it('bounds an admitted large hang at 180 seconds and retains one cause', async () => {
    const { child, observer, promise } = startValidator({
      wire: JSON.stringify({ body: 'x'.repeat(84 * 1024 * 1024) }),
    });
    const outcome = promise.catch((error: unknown) => error);
    jest.advanceTimersByTime(179999);
    expect(observer).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    child.emit(
      'error',
      Object.assign(new Error('PRIVATE_ERROR'), { code: 'EPIPE' }),
    );
    child.stdout.emit('data', Buffer.from('{"valid":true}'));
    child.emit('close', 0, null);
    await expect(outcome).resolves.toMatchObject({
      code: 'VALIDATOR_UNAVAILABLE',
    });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'DEADLINE',
        elapsedMs: 180000,
        stdoutBytes: 0,
        timerFired: true,
        closeObserved: false,
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
