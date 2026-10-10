import { vi } from "vitest";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  effects: [] as {
    deps: readonly unknown[];
    setup: () => (() => void) | void;
    cleanup?: () => void;
  }[],
  pending: [] as { cleanup?: () => void; setup: () => void }[],
  refCursor: 0,
  effectCursor: 0,
}));
vi.mock("react", () => ({
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refCursor++] ??= { current: initial }),
  useEffect: (effect: () => (() => void) | void, deps: readonly unknown[]) => {
    const index = hooks.effectCursor++;
    const old = hooks.effects[index];
    if (
      old &&
      deps.length === old.deps.length &&
      deps.every((dep, i) => Object.is(dep, old.deps[i]))
    )
      return;
    hooks.pending.push({
      cleanup: old?.cleanup,
      setup: () => {
        hooks.effects[index] = {
          deps,
          setup: effect,
          cleanup: effect() || undefined,
        };
      },
    });
  },
}));
export function resetResumeRuntime() {
  hooks.refs = [];
  hooks.effects = [];
  hooks.pending = [];
  hooks.refCursor = hooks.effectCursor = 0;
}
export function renderResumeRuntime(render: () => void) {
  hooks.refCursor = hooks.effectCursor = 0;
  render();
  const pending = hooks.pending.splice(0);
  pending.forEach((effect) => effect.cleanup?.());
  pending.forEach((effect) => effect.setup());
}
export function unmountResumeRuntime() {
  hooks.effects.forEach((effect) => effect.cleanup?.());
}
export const resumeTurn = () =>
  new Promise<void>((resolve) => setImmediate(resolve));
export function replayResumeEffects() {
  unmountResumeRuntime();
  hooks.effects.forEach((effect) => {
    effect.cleanup = effect.setup() || undefined;
  });
}
