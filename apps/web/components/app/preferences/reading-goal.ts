export const DEFAULT_READING_GOAL_MINUTES = 60;
export const MIN_READING_GOAL_MINUTES = 1;
export const MAX_READING_GOAL_MINUTES = 1440;

export function parseReadingGoal(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && !/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  if (
    !Number.isInteger(value) ||
    value < MIN_READING_GOAL_MINUTES ||
    value > MAX_READING_GOAL_MINUTES
  ) {
    return null;
  }
  return value;
}
