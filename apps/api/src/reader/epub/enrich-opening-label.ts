export function enrichOpeningLabel(
  label: string,
  opening: string | null,
): string {
  if (!opening || !opening.includes(' / ')) return label;
  const normalize = (text: string) =>
    text.replace(/\s+/gu, ' ').trim().toLowerCase();
  return opening
    .split(' / ')
    .some((part) => normalize(part) === normalize(label))
    ? opening
    : label;
}
