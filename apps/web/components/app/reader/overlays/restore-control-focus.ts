/** Return keyboard focus after a responsive panel closes, without stealing it on navigation. */
export function restoreControlFocus(
  origin: Element | null,
  pathname: string,
  selector: string,
) {
  if (pathname !== window.location.pathname) return;
  const visible = (element: HTMLElement) =>
    element.isConnected && element.getClientRects().length > 0;
  const target =
    origin instanceof HTMLElement && visible(origin)
      ? origin
      : Array.from(document.querySelectorAll<HTMLElement>(selector)).find(visible);
  target?.focus();
}
