type PageKey = Pick<
  KeyboardEvent,
  "key" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey" | "defaultPrevented"
>;

// Modified arrows belong to native text selection, word movement or browser
// commands. Only an unhandled plain arrow is an AVA page-turn request.
export function pageKeyDirection(event: PageKey) {
  if (
    event.defaultPrevented ||
    event.shiftKey ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  ) {
    return null;
  }
  if (event.key === "ArrowRight") return "next";
  if (event.key === "ArrowLeft") return "previous";
  return null;
}
