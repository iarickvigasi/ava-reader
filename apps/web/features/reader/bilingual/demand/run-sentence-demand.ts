import { isRetryableTranslationError } from "@/features/offline/buckets/translations";

const SETTLE_DELAY_MS = 150;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;

export async function runSentenceDemand(
  request: () => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  await waitWhileDesired(SETTLE_DELAY_MS, signal);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    signal.throwIfAborted();
    try {
      await request();
      return;
    } catch (error) {
      signal.throwIfAborted();
      if (!isRetryableTranslationError(error) || attempt === MAX_ATTEMPTS - 1)
        throw error;
      await waitWhileDesired(RETRY_BASE_MS * 2 ** attempt, signal);
    }
  }
}

function waitWhileDesired(delayMs: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", abort, { once: true });
  });
}
