// Pure decision for the single header status slot (see [[11-cache-priming]]):
// offline beats priming-progress beats nothing. Once priming completes
// (done === total) the chip dwells for `dwellMs` before hiding — a brief
// "finished" beat, and incidentally all the anti-flicker a fast prime needs.
// Kept pure (explicit `now`/`completedAt` in, next `completedAt` + any pending
// timer out) so every branch is testable without a clock or a renderer.

import type { PrimeProgress } from "./prime-progress";

export type ChipState =
  | { kind: "offline" }
  | { kind: "caching"; done: number; total: number }
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

export function resolveHeaderChip(input: HeaderChipInput): HeaderChipResult {
  const { online, progress, completedAt, now, dwellMs } = input;

  // Offline wins, and ends any dwell so a later reconnect starts fresh.
  if (!online) {
    return { state: { kind: "offline" }, completedAt: null, timerMs: null };
  }

  // Nothing to prime (idle, or a warm device that never reported).
  if (progress === null || progress.total === 0) {
    return NONE;
  }

  // Still priming — show progress, clear any prior completion stamp.
  if (progress.done < progress.total) {
    return {
      state: { kind: "caching", done: progress.done, total: progress.total },
      completedAt: null,
      timerMs: null,
    };
  }

  // Completed (done === total) — dwell from when it first completed, then hide.
  const since = completedAt ?? now;
  const remaining = dwellMs - (now - since);
  if (remaining <= 0) {
    return NONE;
  }
  return {
    state: { kind: "caching", done: progress.done, total: progress.total },
    completedAt: since,
    timerMs: remaining,
  };
}
