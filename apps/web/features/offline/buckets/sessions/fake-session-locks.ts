import { vi } from "vitest";

type Job = {
  callback: (lock: Lock) => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  signal: AbortSignal;
};

export function fakeSessionLocks() {
  let active: Job | null = null;
  const queue: Job[] = [];
  let requested: (() => void) | undefined;
  const run = () => {
    if (active || !queue.length) return;
    const job = queue.shift()!;
    active = job;
    void job
      .callback({} as Lock)
      .then(job.resolve, job.reject)
      .finally(() => {
        if (active === job) active = null;
        run();
      });
  };
  vi.stubGlobal("navigator", {
    onLine: true,
    locks: {
      request: (
        _name: string,
        options: { signal: AbortSignal },
        callback: Job["callback"],
      ) =>
        new Promise<void>((resolve, reject) => {
          const job = { callback, resolve, reject, signal: options.signal };
          options.signal.addEventListener("abort", () => {
            const index = queue.indexOf(job);
            if (index >= 0) {
              queue.splice(index, 1);
              reject(new Error("aborted"));
            }
          });
          queue.push(job);
          requested?.();
          requested = undefined;
          run();
        }),
    },
  });
  return {
    nextRequest: () =>
      new Promise<void>((resolve) => {
        requested = resolve;
      }),
    destroyDocument: () => {
      active = null;
      run();
    },
  };
}
