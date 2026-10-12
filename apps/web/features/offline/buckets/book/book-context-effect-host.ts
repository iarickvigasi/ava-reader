import { vi } from "vitest";

// Node-only effect host: runs production provider callbacks across mount/rerender.
// Browser/DOM timing remains a separate real reader test.
const effectHost = vi.hoisted(() => {
  const slots: unknown[] = [];
  const effects = new Map<
    number,
    {
      deps?: readonly unknown[];
      run: () => void | (() => void);
      cleanup?: () => void;
    }
  >();
  let cursor = 0;
  const pending = new Set<number>();
  return {
    render<T>(run: () => T): T {
      cursor = 0;
      return run();
    },
    reset() {
      slots.length = 0;
      effects.clear();
      pending.clear();
      cursor = 0;
    },
    callback<T>(value: T, deps: readonly unknown[]): T {
      const id = cursor++;
      const before = slots[id] as
        | { value: T; deps: readonly unknown[] }
        | undefined;
      if (!before || deps.some((dep, i) => !Object.is(dep, before.deps[i])))
        slots[id] = { value, deps };
      return (slots[id] as { value: T }).value;
    },
    ref<T>(value: T) {
      const id = cursor++;
      return (slots[id] ??= { current: value }) as { current: T };
    },
    state<T>(
      initial: T | (() => T),
    ): [T, (next: T | ((previous: T) => T)) => void] {
      const id = cursor++;
      if (!(id in slots))
        slots[id] =
          typeof initial === "function" ? (initial as () => T)() : initial;
      return [
        slots[id] as T,
        (next) => {
          slots[id] =
            typeof next === "function"
              ? (next as (previous: T) => T)(slots[id] as T)
              : next;
        },
      ];
    },
    effect(run: () => void | (() => void), deps?: readonly unknown[]) {
      const id = cursor++,
        before = effects.get(id);
      if (
        !before ||
        !deps ||
        !before.deps ||
        deps.some((value, i) => !Object.is(value, before.deps![i]))
      )
        pending.add(id);
      effects.set(id, { deps, run, cleanup: before?.cleanup });
    },
    flush() {
      for (const id of pending) {
        const effect = effects.get(id)!;
        effect.cleanup?.();
        effect.cleanup = effect.run() || undefined;
      }
      pending.clear();
    },
    replayMount() {
      for (const effect of effects.values()) {
        effect.cleanup?.();
        effect.cleanup = effect.run() || undefined;
      }
    },
    unmount() {
      for (const effect of effects.values()) effect.cleanup?.();
      this.reset();
    },
  };
});
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: effectHost.callback,
  useRef: effectHost.ref,
  useState: effectHost.state,
  useEffect: effectHost.effect,
}));

export { effectHost };
