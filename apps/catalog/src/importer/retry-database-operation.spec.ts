import { retryDatabaseOperation } from './retry-database-operation';

const context = { operation: 'importRecord.findMany', kind: 'AUTHOR' };
const timeout = { cause: { originalCode: '57014' } };

describe('retryDatabaseOperation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(['57014', '40001', '40P01'])(
    'retries wrapped SQLSTATE %s',
    async (code) => {
      const action = jest
        .fn()
        .mockRejectedValueOnce({
          meta: {
            driverAdapterError: {
              cause: { originalCode: code },
            },
          },
        })
        .mockResolvedValue('done');
      const result = retryDatabaseOperation(context, action);
      await jest.runAllTimersAsync();
      await expect(result).resolves.toBe('done');
      expect(action).toHaveBeenCalledTimes(2);
    },
  );

  it('stops after three attempts and preserves the error', async () => {
    const action = jest.fn().mockRejectedValue(timeout);
    const result = expect(retryDatabaseOperation(context, action)).rejects.toBe(
      timeout,
    );
    await jest.runAllTimersAsync();
    await result;
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('does not retry data errors or ambiguous connection failures', async () => {
    const error = { code: 'ECONNRESET' };
    const action = jest.fn().mockRejectedValue(error);
    await expect(retryDatabaseOperation(context, action)).rejects.toBe(error);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
