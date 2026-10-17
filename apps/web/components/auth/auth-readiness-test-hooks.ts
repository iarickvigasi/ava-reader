import type { EffectCallback } from "react";

type Effect = { deps: readonly unknown[]; cleanup?: () => void };
export const authHooks = {
  stateCursor: 0,
  effectCursor: 0,
  states: [] as unknown[],
  effects: [] as Effect[],
  layout: [] as (() => void)[],
  passive: [] as (() => void)[],
};

function schedule(
  layout: boolean,
  effect: EffectCallback,
  deps: readonly unknown[],
) {
  const index = authHooks.effectCursor++,
    old = authHooks.effects[index];
  if (
    old &&
    deps.length === old.deps.length &&
    deps.every((dep, i) => Object.is(dep, old.deps[i]))
  )
    return;
  authHooks[layout ? "layout" : "passive"].push(() => {
    old?.cleanup?.();
    authHooks.effects[index] = { deps, cleanup: effect() || undefined };
  });
}

export const authMockHooks = {
  useState(initial: unknown) {
    const index = authHooks.stateCursor++;
    if (!(index in authHooks.states))
      authHooks.states[index] =
        typeof initial === "function" ? initial() : initial;
    return [
      authHooks.states[index],
      (next: unknown) => {
        authHooks.states[index] =
          typeof next === "function" ? next(authHooks.states[index]) : next;
      },
    ];
  },
  useEffect: (effect: EffectCallback, deps: readonly unknown[]) =>
    schedule(false, effect, deps),
  useLayoutEffect: (effect: EffectCallback, deps: readonly unknown[]) =>
    schedule(true, effect, deps),
};

export function resetAuthHooks() {
  authHooks.stateCursor = authHooks.effectCursor = 0;
  authHooks.states = [];
  authHooks.effects = [];
  authHooks.layout = [];
  authHooks.passive = [];
}
