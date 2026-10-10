import type { BookSaveStatus } from "./bucket";

export type BookContextStatus =
  | "hydrating"
  | "ready"
  | "saving"
  | "missing-offline"
  | "failed";

export function deriveStatus(input: {
  hasCached: boolean | null;
  online: boolean;
  saveStatus: BookSaveStatus;
}): BookContextStatus {
  if (input.hasCached === null) return "hydrating";
  if (input.hasCached) return "ready";
  if (input.saveStatus === "saving") return "saving";
  if (input.saveStatus === "failed") return "failed";
  return input.online ? "saving" : "missing-offline";
}
