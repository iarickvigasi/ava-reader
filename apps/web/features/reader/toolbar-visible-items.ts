const PRIORITY = [
  "contents",
  "preferences",
  "bilingualMode",
  "highlights",
  "aiComments",
  "aiChats",
];

export function toolbarVisibleItems(
  widths: number[],
  available: number,
  gap: number,
  trigger: number,
  ids: string[],
) {
  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(0, widths.length - 1);
  if (total <= available) return ids;
  let remaining = available - trigger;
  const visible: string[] = [];
  for (const id of PRIORITY) {
    const index = ids.indexOf(id);
    if (index < 0) continue;
    const required = widths[index] + gap;
    if (required > remaining) break;
    visible.push(id);
    remaining -= required;
  }
  return ids.filter((id) => visible.includes(id));
}
