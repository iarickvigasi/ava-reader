"use client";

import { usePreference } from "./use-preference";

export const DEFAULT_READING_GOAL_MINUTES = 60;
const MIN_GOAL_MINUTES = 1;
const MAX_GOAL_MINUTES = 1440; // matches the API DTO bound (24 hours)

const STORAGE_KEY = "ava.reader.readingGoalMinutes";

function parseReadingGoal(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < MIN_GOAL_MINUTES || rounded > MAX_GOAL_MINUTES) return null;
  return rounded;
}

export function useReadingGoal(): [number, (next: number) => void] {
  return usePreference({
    field: "readingGoalMinutes",
    storageKey: STORAGE_KEY,
    defaultValue: DEFAULT_READING_GOAL_MINUTES,
    parse: parseReadingGoal,
  });
}
