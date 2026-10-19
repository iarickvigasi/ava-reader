/** Restore clipped table ancestors before measuring the same visible cell range. */
export function restoreTableGrid(
  candidate: HTMLElement,
  template: HTMLElement,
) {
  for (const partial of candidate.querySelectorAll<HTMLElement>(
    "[data-bilingual-table]",
  )) {
    const original = [
      ...template.querySelectorAll<HTMLElement>("[data-bilingual-table]"),
    ].find((t) => t.dataset.bilingualTable === partial.dataset.bilingualTable);
    if (!original) continue;
    const full = original.cloneNode(true) as HTMLElement;
    for (const cell of full.querySelectorAll<HTMLElement>(
      "[data-bilingual-cell]",
    )) {
      const selected = [
        ...partial.querySelectorAll<HTMLElement>("[data-bilingual-cell]"),
      ].find((c) => c.dataset.bilingualCell === cell.dataset.bilingualCell);
      const header = cell.querySelector<HTMLElement>(
        "[data-bilingual-header-context]",
      );
      cell.replaceChildren(
        ...(selected
          ? [...selected.childNodes].map((n) => n.cloneNode(true))
          : []),
      );
      const hasUnits = !!cell.querySelector("[data-bilingual-unit-id]");
      if (!hasUnits && header) {
        header.hidden = false;
        header.removeAttribute("aria-hidden");
        cell.replaceChildren(header);
      }
    }
    partial.replaceWith(full);
  }
}
