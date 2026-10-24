export type FeedAnchor = { path: string; top: number };

export function readFeedAnchor(): FeedAnchor | undefined {
  const heading = [...document.querySelectorAll("article h3")].find(
    (element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight
      );
    },
  );
  const link = heading?.closest<HTMLAnchorElement>("a");
  return link
    ? { path: link.pathname, top: heading!.getBoundingClientRect().top }
    : undefined;
}

export function restoreFeedPosition(scroll: number, anchor?: FeedAnchor) {
  let frame = 0;
  const heading = [...document.querySelectorAll("article h3")].find(
    (element) =>
      element.closest<HTMLAnchorElement>("a")?.pathname === anchor?.path &&
      element.getBoundingClientRect().height > 0,
  );
  const restore = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() =>
      window.scrollTo(
        0,
        heading && anchor
          ? window.scrollY + heading.getBoundingClientRect().top - anchor.top
          : scroll,
      ),
    );
  };
  const observer = new ResizeObserver(restore);
  const grid = heading?.closest("section");
  if (grid) observer.observe(grid);
  const events = ["wheel", "touchstart", "pointerdown", "keydown"];
  const stop = () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    events.forEach((event) => window.removeEventListener(event, stop));
  };
  const timer = setTimeout(stop, 2000);
  events.forEach((event) =>
    window.addEventListener(event, stop, { passive: true }),
  );
  restore();
  return stop;
}
