export function enrichOpeningLabel(
  label: string,
  opening: string | null,
): string {
  if (opening && /^\d+\.?$/.test(label.trim())) return opening;
  if (!opening || !opening.includes(' / ')) return label;
  const normalize = (text: string) =>
    text.replace(/\s+/gu, ' ').trim().toLowerCase();
  if (normalize(opening).startsWith(`${normalize(label)} / `)) return opening;
  return opening
    .split(' / ')
    .some((part) => normalize(part) === normalize(label))
    ? opening
    : label;
}
