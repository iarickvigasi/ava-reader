import { ServiceUnavailableException } from '@nestjs/common';
import { fixtureBytes } from '../../../pdf-conversion/contracts/contract-fixtures';
import {
  ReaderValidationCache,
  type ReaderSemanticValidator,
} from './reader-validation-cache';

const scope = {
  actualSha256: 'a'.repeat(64),
  byteLength: 10,
  adapterFingerprint: 'adapter',
  readerBuildFingerprint: 'reader-build',
};
const validator = () =>
  Object.assign(
    jest.fn(() => Promise.resolve(true)),
    {
      validationIdentity: (): string => 'version-one',
    },
  );
const run = (
  cache: ReaderValidationCache,
  semantic: ReaderSemanticValidator,
  change = {},
) =>
  cache.semanticFor(semantic, { ...scope, ...change })(
    'ava-reader-3',
    {},
    '{}',
  );

describe('accepted-reader semantic result cache', () => {
  it('isolates actual digest, contract, adapter/build, semantic function and configuration', async () => {
    const cache = new ReaderValidationCache();
    const semantic = validator();
    await run(cache, semantic);
    await run(cache, semantic);
    expect(semantic).toHaveBeenCalledTimes(1);
    await run(cache, semantic, { actualSha256: 'b'.repeat(64) });
    await run(cache, semantic, { adapterFingerprint: 'other' });
    await run(cache, semantic, { readerBuildFingerprint: 'other' });
    await cache.semanticFor(semantic, scope)(
      'ava-accepted-content-1',
      {},
      '{}',
    );
    semantic.validationIdentity = () => 'version-two';
    await run(cache, semantic);
    expect(semantic).toHaveBeenCalledTimes(6);
    const other = validator();
    await run(cache, other);
    expect(other).toHaveBeenCalledTimes(1);
  });
  it('does not cache a callback with unknown configuration identity', async () => {
    const cache = new ReaderValidationCache();
    const semantic = jest.fn(() => Promise.resolve(true));
    await run(cache, semantic);
    await run(cache, semantic);
    expect(semantic).toHaveBeenCalledTimes(2);
  });
  it('retries false results and thrown failures and releases their slots', async () => {
    const cache = new ReaderValidationCache({ maxInFlight: 1 });
    const semantic = validator()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('unavailable'));
    await expect(run(cache, semantic)).resolves.toBe(false);
    await expect(run(cache, semantic)).rejects.toThrow('unavailable');
    await expect(run(cache, semantic)).resolves.toBe(true);
    await expect(run(cache, semantic)).resolves.toBe(true);
    expect(semantic).toHaveBeenCalledTimes(3);
  });
  it('evicts by source byte budget and LRU while retaining recently used entries', async () => {
    const cache = new ReaderValidationCache({ maxBytes: 20 });
    const semantic = validator();
    await run(cache, semantic);
    await run(cache, semantic, { actualSha256: 'b' });
    await run(cache, semantic);
    await run(cache, semantic, { actualSha256: 'c' });
    await run(cache, semantic);
    expect(semantic).toHaveBeenCalledTimes(3);
    await run(cache, semantic, { actualSha256: 'b' });
    expect(semantic).toHaveBeenCalledTimes(4);
  });
  it('expires results and bounds entry count even for tiny inputs', async () => {
    let now = 0;
    const cache = new ReaderValidationCache(
      { maxEntries: 1, ttlMs: 10 },
      () => now,
    );
    const semantic = validator();
    await run(cache, semantic);
    now = 10;
    await run(cache, semantic);
    await run(cache, semantic, { actualSha256: 'b' });
    await run(cache, semantic);
    expect(semantic).toHaveBeenCalledTimes(4);
  });
  it('validates an oversized cache entry but does not retain it', async () => {
    const cache = new ReaderValidationCache({ maxBytes: 9 });
    const semantic = validator();
    await run(cache, semantic);
    await run(cache, semantic);
    expect(semantic).toHaveBeenCalledTimes(2);
  });
  it.each([{ maxInFlight: 1 }, { maxInFlightBytes: 20 }])(
    'coalesces one fill and refuses distinct over-capacity fills: %j',
    async (limit) => {
      let finish!: (valid: boolean) => void;
      const semantic = validator().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      );
      const cache = new ReaderValidationCache(limit);
      const first = run(cache, semantic);
      const same = run(cache, semantic);
      await expect(
        run(cache, semantic, { actualSha256: 'b' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(semantic).toHaveBeenCalledTimes(1);
      finish(true);
      await expect(Promise.all([first, same])).resolves.toEqual([true, true]);
      semantic.mockResolvedValue(true);
      await run(cache, semantic, { actualSha256: 'b' });
      expect(semantic).toHaveBeenCalledTimes(2);
    },
  );
});

it.each([true, false])(
  'accounts identical waiters and releases all byte weight after %s',
  async (valid) => {
    let finish!: (valid: boolean) => void;
    const semantic = validator().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const cache = new ReaderValidationCache({ maxInFlightBytes: 20 });
    const first = run(cache, semantic);
    const second = run(cache, semantic);
    await expect(run(cache, semantic)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    finish(valid);
    await expect(Promise.all([first, second])).resolves.toEqual([valid, valid]);
    semantic.mockResolvedValue(true);
    await expect(run(cache, semantic, { actualSha256: 'new' })).resolves.toBe(
      true,
    );
  },
);
it('releases coalesced byte weight after a validator rejection', async () => {
  let fail!: (error: Error) => void;
  const semantic = validator().mockImplementation(
    () =>
      new Promise<boolean>((_resolve, reject) => {
        fail = reject;
      }),
  );
  const cache = new ReaderValidationCache({ maxInFlightBytes: 20 });
  const first = run(cache, semantic);
  const second = run(cache, semantic);
  await expect(run(cache, semantic)).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
  const rejected = Promise.allSettled([first, second]);
  fail(new Error('failed'));
  expect((await rejected).every((value) => value.status === 'rejected')).toBe(
    true,
  );
  semantic.mockResolvedValue(true);
  await expect(run(cache, semantic)).resolves.toBe(true);
});
it('does not retain a success when validator identity changes during validation', async () => {
  let finish!: (valid: boolean) => void;
  const semantic = validator().mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const cache = new ReaderValidationCache();
  const first = run(cache, semantic);
  await Promise.resolve();
  semantic.validationIdentity = () => 'version-two';
  finish(true);
  await first;
  semantic.validationIdentity = () => 'version-one';
  await run(cache, semantic);
  expect(semantic).toHaveBeenCalledTimes(2);
});
it('bypasses caching when installed validator identity is unknown', async () => {
  const semantic = Object.assign(
    jest.fn(() => Promise.resolve(true)),
    { validationIdentity: () => Promise.resolve(null) },
  );
  const cache = new ReaderValidationCache();
  await run(cache, semantic);
  await run(cache, semantic);
  expect(semantic).toHaveBeenCalledTimes(2);
});
it('retains successful receipts for representative 33MiB and 128MiB reader inputs', async () => {
  const cache = new ReaderValidationCache();
  const semantic = validator();
  // Logical wire-size accounting only: no synthetic large parsed graph allocation.
  for (const size of [33, 128]) {
    const change = {
      actualSha256: `reader-${size}`,
      byteLength: size * 1024 * 1024,
    };
    await run(cache, semantic, change);
    await run(cache, semantic, change);
  }
  expect(semantic).toHaveBeenCalledTimes(2);
});

it('reserves caller bytes before parsing and releases them after validation', async () => {
  const bytes = fixtureBytes('ava-reader-3');
  let finish!: (valid: boolean) => void;
  const semantic = validator().mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const cache = new ReaderValidationCache({ maxInFlightBytes: bytes.length });
  const first = cache.validate('ava-reader-3', bytes, semantic, scope);
  await Promise.resolve();
  // This would raise INVALID_CONTRACT if the JSON parser ran before admission.
  await expect(
    cache.validate('ava-reader-3', Buffer.from('{'), semantic, scope),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
  finish(true);
  await first;
  await expect(
    cache.validate('ava-reader-3', Buffer.from('{'), semantic, scope),
  ).rejects.toThrow('INVALID_CONTRACT');
  await expect(
    cache.validate('ava-reader-3', bytes, semantic, scope),
  ).resolves.toHaveProperty('version', 3);
});
