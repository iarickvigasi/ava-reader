import { spawn } from 'node:child_process';
import { pythonSemanticValidator } from './python-semantic-validator';
import { MAX_CONTRACT_BYTES } from './parse-json';
import { startValidator } from './semantic-validator-test-fixture';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

describe('isolated Python validation outcomes and bounds', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(spawn).mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it.each([
    [0, true],
    [1, false],
  ] as const)('retains exit %s validation %s', async (code, valid) => {
    const { child, observer, promise } = startValidator();
    child.stdout.emit('data', Buffer.from(JSON.stringify({ valid })));
    child.emit('close', code, null);
    await expect(promise).resolves.toBe(valid);
    expect(observer).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      '/private/test-validator',
      ['-I', '-m', 'ava_pdf_epub.contracts', 'validate'],
      {
        shell: false,
        stdio: ['pipe', 'pipe', 'ignore'],
        env: { LANG: 'C.UTF-8' },
      },
    );
    expect(child.stdin.end).toHaveBeenCalledWith(
      '{"schema_version":"ava-reader-3","payload":{"body":"PRIVATE_BODY"}}',
    );
  });
  it('accepts exactly 1024 stdout bytes across chunks', async () => {
    const { child, promise } = startValidator();
    const text = '{"valid":true}'.padEnd(1024);
    child.stdout.emit('data', Buffer.from(text.slice(0, 10)));
    child.stdout.emit('data', Buffer.from(text.slice(10)));
    child.emit('close', 0, null);
    await expect(promise).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('counts multibyte overflow across chunks and refuses at 1025 bytes', async () => {
    const { child, observer, promise } = startValidator();
    child.stdout.emit('data', Buffer.from('😀'.repeat(128)));
    child.stdout.emit('data', Buffer.from('😀'.repeat(128) + 'x'));
    await expect(promise).rejects.toMatchObject({
      code: 'VALIDATOR_UNAVAILABLE',
    });
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'OUTPUT_LIMIT',
        stdoutBytes: 1025,
        timerFired: false,
      }),
    );
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('keeps invalid executable and oversized wire refusals before spawning', async () => {
    const observer = jest.fn();
    expect(() => pythonSemanticValidator('relative', observer)).toThrow(
      'VALIDATOR_UNAVAILABLE',
    );
    await expect(
      pythonSemanticValidator('/private/test-validator', observer)(
        'ava-reader-3',
        null,
        'x'.repeat(MAX_CONTRACT_BYTES),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CONTRACT' });
    expect(spawn).not.toHaveBeenCalled();
    expect(
      observer.mock.calls.map(([x]) => (x as { reason: string }).reason),
    ).toEqual(['INVALID_EXECUTABLE', 'INPUT_LIMIT']);
    expect(jest.getTimerCount()).toBe(0);
  });
});
