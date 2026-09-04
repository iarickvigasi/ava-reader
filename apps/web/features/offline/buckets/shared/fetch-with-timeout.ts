// fetch() with a time-to-first-byte guard. Races the fetch against a timer
// that both aborts the real request (freeing the connection) and rejects the
// race outright — so this times out deterministically even against a
// fetch/test-double that never resolves and never observes the abort
// signal. Callers only see the TTFB: once the returned Response is in hand,
// nothing here bounds how long the caller then takes to read its body.

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      timedOut,
    ]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
