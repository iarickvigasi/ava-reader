type TabKey = Pick<
  KeyboardEvent,
  | "key"
  | "shiftKey"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "defaultPrevented"
  | "preventDefault"
>;

const TAB_STOPS =
  "button, a[href], input, select, textarea, summary, [tabindex], [contenteditable]";

// Closed details expose only their first direct summary, even when locked content has rectangles.
function hiddenByDetails(control: HTMLElement) {
  for (
    let ancestor = control.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor.tagName !== "DETAILS" || (ancestor as HTMLDetailsElement).open)
      continue;
    const summary = Array.from(ancestor.children).find(
      (child) => child.tagName === "SUMMARY",
    );
    if (!summary?.contains(control)) return true;
  }
  return false;
}

function available(control: HTMLElement, dialog: HTMLDialogElement) {
  const visibility =
    control.ownerDocument.defaultView?.getComputedStyle(control).visibility;
  return (
    control.tabIndex >= 0 &&
    !control.matches(":disabled") &&
    !control.closest("[hidden], [inert]") &&
    !hiddenByDetails(control) &&
    control.closest("dialog") === dialog &&
    control.getClientRects().length > 0 &&
    visibility !== "hidden" &&
    visibility !== "collapse"
  );
}

// Native modality keeps the document inert; an explicit boundary prevents plain
// Tab from continuing into browser chrome. Other browser shortcuts remain native.
export function retainPanelTabFocus(dialog: HTMLDialogElement, event: TabKey) {
  if (
    !dialog.open ||
    !dialog.isConnected ||
    event.defaultPrevented ||
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const active = dialog.ownerDocument.activeElement;
  if (
    !active ||
    !dialog.contains(active) ||
    (active !== dialog && active.closest("dialog") !== dialog)
  )
    return;
  // Recompute for loading results, disabled controls and collapsed Contents.
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>(TAB_STOPS))
    .filter((control) => available(control, dialog))
    .sort(
      (a, b) =>
        (a.tabIndex || Number.MAX_SAFE_INTEGER) -
        (b.tabIndex || Number.MAX_SAFE_INTEGER),
    );
  const first = controls[0],
    last = controls.at(-1);
  const current = controls.indexOf(active as HTMLElement);
  if (current >= 0 && (event.shiftKey ? active !== first : active !== last))
    return;
  event.preventDefault();
  // Let native focus scrolling reveal an offscreen control inside the panel.
  (event.shiftKey ? last : first)?.focus();
  if (!first) dialog.focus();
}
