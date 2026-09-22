import { TranslationLock } from './translation-lock';
import { generateTranslations } from './generate-translations';
import { generationFixture } from '../testing/generation.fixture';

describe('translation scheduling', () => {
  it('deduplicates overlapping work by rechecking cache after the preceding write', async () => {
    const fixture = generationFixture();
    const lock = new TranslationLock();
    const work = () => generateTranslations(fixture.args);
    const results = await Promise.all([
      lock.run('version', fixture.args.signal, work),
      lock.run('version', fixture.args.signal, work),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(fixture.getModel).toHaveBeenCalledTimes(1);
  });

  it('skips canceled queued work and releases the queue after failures', async () => {
    const lock = new TranslationLock();
    const active = new AbortController();
    let release!: () => void;
    const first = lock.run(
      'version',
      active.signal,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const queuedController = new AbortController();
    const queuedWork = jest.fn(() => Promise.resolve('should not run'));
    const queued = lock.run('version', queuedController.signal, queuedWork);
    const rejection = expect(queued).rejects.toThrow();
    queuedController.abort();
    await Promise.resolve();
    release();
    await first;
    await rejection;
    expect(queuedWork).not.toHaveBeenCalled();
    await expect(
      lock.run('version', active.signal, () => Promise.resolve('fresh')),
    ).resolves.toBe('fresh');
  });
});
