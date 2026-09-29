// Infrastructure failures pause polling; only a claimed import decides its own outcome.
export class ReaderProcessingLoop {
  private running = false;
  private failures = 0;
  private retryAt = 0;

  async run(
    tick: () => Promise<boolean>,
    report: (code: string, retryMs: number) => void,
  ): Promise<boolean> {
    if (this.running || performance.now() < this.retryAt) return false;
    this.running = true;
    try {
      const processed = await tick();
      this.failures = 0;
      this.retryAt = 0;
      return processed;
    } catch (error: unknown) {
      this.failures = Math.min(this.failures + 1, 5);
      const retryMs = Math.min(2000 * 2 ** (this.failures - 1), 30000);
      this.retryAt = performance.now() + retryMs;
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^P[0-9]{4}$/.test(error.code)
          ? error.code
          : 'BACKGROUND_UNAVAILABLE';
      report(code, retryMs);
      return false;
    } finally {
      this.running = false;
    }
  }
}
