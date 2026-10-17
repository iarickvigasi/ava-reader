import type { ReaderLocator } from "@/lib/api-types";
import type { QaCommand, QaScope } from "./protocol";
const actions = new Set([
  "snapshot",
  "arm-fail",
  "arm-hold",
  "release",
  "cancel",
  "inject-stale",
]);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 500;
const scope = (value: unknown): value is QaScope =>
  record(value) &&
  text(value.libraryItemId) &&
  text(value.finalContentId) &&
  text(value.readerFingerprint) &&
  (value.accountScope === undefined || text(value.accountScope));
const point = (value: unknown): value is ReaderLocator =>
  record(value) &&
  text(value.chapterId) &&
  typeof value.blockId === "string" &&
  value.blockId.length <= 500 &&
  Number.isSafeInteger(value.textOffset) &&
  Number(value.textOffset) >= 0;
export function parseQaCommand(value: unknown): QaCommand | null {
  if (
    !record(value) ||
    value.type !== "command" ||
    !text(value.commandId) ||
    !scope(value.scope) ||
    !actions.has(String(value.action))
  )
    return null;
  if (value.action === "arm-fail" || value.action === "arm-hold") {
    if (
      !point(value.target) ||
      (value.stage !== "navigate" && value.stage !== "restore")
    )
      return null;
  }
  if (
    value.action === "inject-stale" &&
    (!point(value.target) || !scope(value.entryScope))
  )
    return null;
  return value as unknown as QaCommand;
}
