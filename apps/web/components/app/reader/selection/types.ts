export type SelectionPointer = "touch" | "mouse";

export type ReaderSelection = {
  text: string;
  // The live DOM range. The caller may inspect it synchronously (e.g., to
  // compute an offset locator) but must not retain it past the current tick —
  // browsers reuse selection objects and the underlying nodes can re-render.
  range: Range;
  // Which input built the selection. A touch capture makes the AI toolbox
  // drop the live selection when it opens (native callout suppression, see
  // use-drop-live-selection); a mouse capture keeps its selection.
  pointer: SelectionPointer;
};
