type Ownership = { exclusive: boolean; release: () => void };

// Locks disappear with a destroyed document, permitting immediate crash recovery.
// Older browsers retain the transactional lease and its bounded takeover delay.
export function acquireSessionOwnership(
  name: string,
  signal: AbortSignal,
): Promise<Ownership | null> {
  if (typeof navigator === "undefined" || !navigator.locks)
    return Promise.resolve({ exclusive: false, release: () => undefined });
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request(`reading-session:${name}`, { signal }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        return new Promise<void>((release) =>
          resolve({ exclusive: true, release }),
        );
      })
      .catch((error: unknown) =>
        signal.aborted ? resolve(null) : reject(error),
      );
  });
}
