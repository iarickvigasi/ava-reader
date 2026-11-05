import type { ReaderAuthInput } from "@/components/app/reader/data/reader-auth";

const AUTH_BOOT_TIMEOUT_MS = 2_500;
const AUTH_POLL_INTERVAL_MS = 100;

export async function waitForReaderAuth(
  readAuth: () => ReaderAuthInput,
  signal: AbortSignal,
): Promise<ReaderAuthInput> {
  signal.throwIfAborted();
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const check = () => {
      const auth = readAuth();
      if (auth.isLoaded || Date.now() - startedAt >= AUTH_BOOT_TIMEOUT_MS) {
        cleanup();
        resolve(auth);
        return;
      }
      timer = setTimeout(check, AUTH_POLL_INTERVAL_MS);
    };
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}
