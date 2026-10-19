import { vi } from "vitest";
import { useMeasurementCache } from "./use-measurement-cache";
import { useChapterMeasurements } from "./use-chapter-measurements";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  cursor: 0,
  effectCursor: 0,
  dirty: false,
}));
vi.mock("react", () => ({
  useState(initial: unknown) {
    const index = h.cursor++;
    if (!(index in h.slots))
      h.slots[index] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[index],
      (next: unknown) => {
        const value = typeof next === "function" ? next(h.slots[index]) : next;
        if (!Object.is(value, h.slots[index])) h.dirty = true;
        h.slots[index] = value;
      },
    ];
  },
  useRef(initial: unknown) {
    const index = h.cursor++;
    return (h.slots[index] ??= { current: initial });
  },
  useMemo(create: () => unknown, deps: unknown[]) {
    const index = h.cursor++,
      old = h.slots[index] as { deps: unknown[]; value: unknown } | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i])))
      h.slots[index] = { deps, value: create() };
    return (h.slots[index] as { value: unknown }).value;
  },
  useCallback(callback: unknown, deps: unknown[]) {
    const index = h.cursor++,
      old = h.slots[index] as { deps: unknown[]; value: unknown } | undefined;
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i])))
      h.slots[index] = { deps, value: callback };
    return (h.slots[index] as { value: unknown }).value;
  },
  useLayoutEffect(effect: () => (() => void) | void, deps: unknown[]) {
    const index = h.effectCursor++,
      old = h.effects[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i])))
      h.pending.push(() => {
        old?.cleanup?.();
        h.effects[index] = { deps, cleanup: effect() || undefined };
      });
  },
}));
export function resetMeasurementRuntime() {
  h.effects.forEach((effect) => effect.cleanup?.());
  h.slots = [];
  h.effects = [];
  h.pending = [];
  h.dirty = false;
}
type CacheInput = Parameters<typeof useMeasurementCache>[0];
type PreloaderInput = Omit<
  Parameters<typeof useChapterMeasurements>[0],
  "onMeasurement"
>;
function CacheProbe(input: CacheInput) {
  return useMeasurementCache(input);
}
function PreloaderProbe(input: CacheInput, preloader: PreloaderInput) {
  const result = useMeasurementCache(input);
  useChapterMeasurements({
    ...preloader,
    onMeasurement: result.storeMeasurementEntry,
  });
  return result;
}
export function renderMeasurementRuntime(
  input: CacheInput,
  preloader?: PreloaderInput,
) {
  let result: ReturnType<typeof useMeasurementCache>;
  for (let turn = 0; turn < 20; turn++) {
    h.cursor = h.effectCursor = 0;
    h.pending = [];
    h.dirty = false;
    result = preloader ? PreloaderProbe(input, preloader) : CacheProbe(input);
    if (h.dirty) continue;
    h.pending.splice(0).forEach((effect) => effect());
    if (!h.dirty) return result;
  }
  throw new Error("MEASUREMENT_RENDER_DID_NOT_SETTLE");
}
export function retainedEntryCount() {
  const state = h.slots.find(
    (slot) =>
      slot instanceof Map ||
      (!!slot && typeof slot === "object" && "entries" in slot),
  );
  return state instanceof Map
    ? state.size
    : (state as { entries: Map<string, unknown> }).entries.size;
}
