"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_READING_GOAL_MINUTES, parseReadingGoal } from "./reading-goal";
import { usePreference } from "./use-preference";

export { DEFAULT_READING_GOAL_MINUTES } from "./reading-goal";

const STORAGE_KEY = "ava.reader.readingGoalMinutes";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useReadingGoal(
  defaultValue = DEFAULT_READING_GOAL_MINUTES,
): [number, (next: number) => void] {
  const [goal, setGoal] = usePreference({
    field: "readingGoalMinutes",
    storageKey: STORAGE_KEY,
    defaultValue,
    parse: parseReadingGoal,
  });
  // Home renders its server goal during hydration. The saved local preference
  // takes over afterwards, including edits made while offline.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const update = useCallback((next: number) => {
    const parsed = parseReadingGoal(next);
    if (parsed !== null && parsed !== goal) setGoal(parsed);
  }, [goal, setGoal]);

  return [hydrated ? goal : defaultValue, update];
}
