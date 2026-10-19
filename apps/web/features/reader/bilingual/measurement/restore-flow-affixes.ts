export function restoreFlowAffixes(
  candidate: HTMLElement,
  template: HTMLElement,
) {
  const selected = new Set(
    [
      ...candidate.querySelectorAll<HTMLElement>("[data-bilingual-unit-id]"),
    ].map((e) => e.dataset.bilingualUnitId),
  );
  for (const affix of template.querySelectorAll<HTMLElement>(
    "[data-bilingual-affix]",
  )) {
    if (!selected.has(affix.dataset.bilingualAffix)) continue;
    const unit = [
      ...candidate.querySelectorAll<HTMLElement>("[data-bilingual-unit-id]"),
    ].find((e) => e.dataset.bilingualUnitId === affix.dataset.bilingualAffix);
    const block = unit?.closest("[data-bilingual-flow-block]");
    if (block && !block.querySelector("[data-bilingual-affix]"))
      block.appendChild(affix.cloneNode(true));
  }
}
