import type { PendingMutation } from "@/features/offline/buckets/ai-comments";
import type { ReaderRangeLocator } from "@/lib/api-types";
import type { AiToolPayload } from "./use-ai-tool";

// The bucket's generate-mutation envelope (the three streaming kinds).
type GenerateIntent = Extract<
  PendingMutation,
  { kind: "generate.translate" | "generate.etymology" | "generate.explain" }
>;

// The payload's `locator` is a JSON-serialised string (the server's wire
// format). The bucket keeps a parsed ReaderRangeLocator alongside it so the
// reader's underline-applier can target the range without re-parsing.
function parseLocator(raw: string | undefined): ReaderRangeLocator | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReaderRangeLocator;
  } catch {
    return null;
  }
}

// Pure: maps a toolbox payload to the bucket's generate-mutation envelope so
// an offline request can be queued and replayed verbatim on reconnect.
export function buildGenerateIntent(
  payload: AiToolPayload,
  id: string,
  queuedAt: string,
): GenerateIntent {
  const locator = parseLocator(payload.locator);
  if (payload.kind === "translate") {
    return {
      kind: "generate.translate",
      id,
      payload: {
        text: payload.text,
        targetLang: payload.targetLang,
        locator: payload.locator,
      },
      locator,
      queuedAt,
    };
  }
  if (payload.kind === "etymology") {
    return {
      kind: "generate.etymology",
      id,
      payload: { text: payload.text, locator: payload.locator },
      locator,
      queuedAt,
    };
  }
  return {
    kind: "generate.explain",
    id,
    payload: {
      text: payload.text,
      context: payload.context,
      bookTitle: payload.bookTitle,
      author: payload.author,
      locator: payload.locator,
    },
    locator,
    queuedAt,
  };
}
