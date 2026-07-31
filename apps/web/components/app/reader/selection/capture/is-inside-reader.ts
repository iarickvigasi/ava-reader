// True when an event's target node lives inside the reader container. Selection
// capture gates on this: events on the open panel, its backdrop, or the
// surrounding chrome must be ignored — only events inside the page box count as
// reader interaction.
export function isInsideReader(
  target: EventTarget | null,
  container: HTMLElement | null,
): boolean {
  return (
    container !== null && target instanceof Node && container.contains(target)
  );
}
