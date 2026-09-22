const TRANSLATION_REQUEST_TIMEOUT_MS = 60_000;

export async function requestWithDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let rejectAbort!: (reason: unknown) => void;
  const abort = () => {
    controller.abort();
    rejectAbort(signal.reason);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new DOMException("The translation request timed out.", "TimeoutError"),
      );
    }, TRANSLATION_REQUEST_TIMEOUT_MS);
  });
  signal.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([request(controller.signal), interrupted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
