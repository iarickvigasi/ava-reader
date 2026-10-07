import { restoreControlFocus } from "./restore-control-focus";

export function openReaderPanelDialog(
  dialog: HTMLDialogElement,
  control: string,
  closePanel: () => void,
) {
  const origin = document.activeElement;
  const pathname = window.location.pathname;
  let closed = false;
  // Native modality supplies document inertness and Tab containment. Do not replace or
  // clear the selected Range: the toolbox already owns its captured passage/context.
  if (!dialog.open) dialog.showModal();
  // React's autoFocus runs while the parent dialog can still be closed. Choose the
  // visible Close control only after native modality is established; Contents and
  // Search can then move focus to their current entry or query in their own effects.
  const initial = dialog.querySelector<HTMLElement>("[data-reader-initial-focus]");
  if (initial?.getClientRects().length) initial.focus({ preventScroll: true });

  function close() {
    if (closed) return false;
    closed = true;
    if (dialog.open) dialog.close();
    return true;
  }

  return {
    dismiss() {
      if (!close()) return;
      closePanel();
      restoreControlFocus(origin, pathname, control);
    },
    navigate(action: () => void) {
      if (!close()) return;
      closePanel();
      // Native close can synchronously restore the opener. The jump runs afterwards
      // and owns the final passage focus; never queue trigger restoration here.
      action();
    },
    dispose: close,
  };
}
