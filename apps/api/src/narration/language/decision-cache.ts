// Bounded, short-lived, process-local cache. Keys include account + context + model.
const MAX_ENTRIES = 256;
const TTL_MS = 10 * 60_000;
const entries = new Map<string, { expires: number; value: Promise<string> }>();

export function cacheLanguageDecision(
  key: string,
  load: () => Promise<string>,
) {
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (entries.size >= MAX_ENTRIES)
    entries.delete(Array.from(entries.keys())[0]);
  const value = load().catch((error: unknown) => {
    if (entries.get(key)?.value === value) entries.delete(key);
    throw error;
  });
  entries.set(key, { expires: Date.now() + TTL_MS, value });
  return value;
}
