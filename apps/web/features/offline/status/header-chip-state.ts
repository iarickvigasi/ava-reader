// Pure decision for the single header status slot (see [[11-cache-priming]]):
// offline beats priming-progress beats nothing. The content tier shows live;
// only the `ready` beat dwells for `dwellMs` before hiding — a brief "finished"
// confirmation, and the anti-flicker tail. Kept pure (explicit `now`/
// `completedAt` in, next `completedAt` + any pending timer out) so every branch
// is testable without a clock or a renderer.

import type { PrimeProgress } from "./prime-progress";

export type ChipState =
  | { kind: "offline" }
  | { kind: "caching"; done: number; total: number } // content tier
  | { kind: "ready" }
  | { kind: "none" };

export type HeaderChipInput = {
  online: boolean;
  progress: PrimeProgress | null;
  completedAt: number | null;
  now: number;
  dwellMs: number;
};

export type HeaderChipResult = {
  state: ChipState;
  completedAt: number | null;
  timerMs: number | null;
};

const NONE: HeaderChipResult = {
  state: { kind: "none" },
  completedAt: null,
  timerMs: null,
};

// A live phase shows immediately and carries no dwell — the next phase (or the
// primer clearing the store) replaces it.
function live(state: ChipState): HeaderChipResult {
  return { state, completedAt: null, timerMs: null };
}

export function resolveHeaderChip(input: HeaderChipInput): HeaderChipResult {
  const { online, progress, completedAt, now, dwellMs } = input;

  // Offline wins, and ends any dwell so a later reconnect starts fresh.
  if (!online) {
    return { state: { kind: "offline" }, completedAt: null, timerMs: null };
  }

  // Nothing to prime (idle, or a warm device that never reported).
  if (progress === null) {
    return NONE;
  }

  if (progress.phase === "content") {
    // total 0 → no marked books; superseded by `ready` momentarily.
    return progress.total === 0
      ? NONE
      : live({ kind: "caching", done: progress.done, total: progress.total });
  }

  // Ready — dwell from when it first completed, then hide.
  const since = completedAt ?? now;
  const remaining = dwellMs - (now - since);
  if (remaining <= 0) {
    return NONE;
  }
  return { state: { kind: "ready" }, completedAt: since, timerMs: remaining };
}
