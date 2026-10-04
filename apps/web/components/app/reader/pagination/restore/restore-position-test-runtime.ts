import { vi } from "vitest";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  dependencies: [] as unknown[][],
  effects: [] as (() => void)[],
  refCursor: 0,
  effectCursor: 0,
  settle: vi.fn(),
}));
vi.mock("react", () => ({
  useRef: (value: unknown) => {
    const i = hooks.refCursor++;
    return hooks.refs[i] ?? (hooks.refs[i] = { current: value });
  },
  useLayoutEffect: (effect: () => void, deps: unknown[]) => {
    const i = hooks.effectCursor++,
      prior = hooks.dependencies[i];
    if (!prior || deps.some((value, j) => !Object.is(value, prior[j]))) {
      hooks.dependencies[i] = deps;
      hooks.effects.push(effect);
    }
  },
}));
vi.mock("../../state/reader-navigation-context", () => ({
  useReaderNavigationActions: () => ({ settle: hooks.settle }),
}));
export function resetPositionRuntime() {
  hooks.refs = [];
  hooks.dependencies = [];
  hooks.effects = [];
  hooks.refCursor = 0;
  hooks.effectCursor = 0;
  hooks.settle.mockClear();
}
export function renderPositionRuntime(render: () => void) {
  hooks.refCursor = 0;
  hooks.effectCursor = 0;
  hooks.effects = [];
  render();
  hooks.effects.forEach((effect) => effect());
}

export function getPositionHooks() {
  return hooks;
}
