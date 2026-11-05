export function onFeedNavigation(leave: () => void) {
  const click = (event: MouseEvent) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a")
        : null;
    if (
      link?.origin === window.location.origin &&
      link.pathname.startsWith("/app/explore/") &&
      link.target !== "_blank"
    )
      leave();
  };
  document.addEventListener("click", click, true);
  window.addEventListener("popstate", leave);
  return () => {
    document.removeEventListener("click", click, true);
    window.removeEventListener("popstate", leave);
  };
}
