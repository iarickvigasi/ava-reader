import { scheduleRetry } from "../shared/bucket-core";

// Keep the frozen stop moment and ownership until its local transaction succeeds.
// A later checkpoint cannot replace the final remainder or count retry waiting time.
export async function retryFinalCheckpoint(save: () => Promise<void>) {
  const retry = {
    retryDelayMs: 0,
    retryHandle: null as ReturnType<typeof setTimeout> | null,
  };
  for (;;) {
    try {
      await save();
      return;
    } catch {
      await new Promise<void>((resolve) => scheduleRetry(retry, resolve));
    }
  }
}
