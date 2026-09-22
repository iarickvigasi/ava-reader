// Serialize writes within a user's book version, then re-read persisted
// sentences before generation. Overlapping current/next requests only pay for
// missing sentences. The database unique key also prevents duplicate storage.
export class TranslationLock {
  private readonly pending = new Map<string, Promise<void>>();

  run<T>(key: string, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const result = previous.then(() => {
      signal.throwIfAborted();
      return work();
    });
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.pending.set(key, tail);
    void tail.then(() => {
      if (this.pending.get(key) === tail) this.pending.delete(key);
    });
    return result;
  }
}
