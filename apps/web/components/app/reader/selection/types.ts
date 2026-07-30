export type ReaderSelection = {
  text: string;
  // The live DOM range. The caller may inspect it synchronously (e.g., to
  // compute an offset locator) but must not retain it past the current tick —
  // browsers reuse selection objects and the underlying nodes can re-render.
  range: Range;
};
