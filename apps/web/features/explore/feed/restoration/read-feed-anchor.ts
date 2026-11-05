import type { FeedAnchor } from "../types";

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
