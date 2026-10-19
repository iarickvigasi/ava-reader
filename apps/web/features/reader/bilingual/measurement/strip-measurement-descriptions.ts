/** Measurement-only clones must not duplicate the live figure ID/IDREF pair. */
export function stripMeasurementDescriptions(candidate: HTMLElement) {
  for (const description of candidate.querySelectorAll<HTMLElement>(
    "[data-bilingual-figure-description]",
  )) {
    const figure = description.closest("figure");
    if (figure?.getAttribute("aria-describedby") === description.id)
      figure.removeAttribute("aria-describedby");
    description.removeAttribute("id");
  }
}
