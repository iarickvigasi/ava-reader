export function virtualCatalogRange(
  count: number,
  columns: number,
  rowHeight: number,
  offset: number,
  height: number,
  focusedIndex = -1,
) {
  const rows = Math.ceil(count / columns);
  const first = Math.max(0, Math.floor(Math.max(0, offset) / rowHeight) - 2);
  const last = Math.min(
    rows,
    Math.ceil((Math.max(0, offset) + height) / rowHeight) + 2,
  );
  const visible = Array.from(
    { length: Math.max(0, last - first) },
    (_, index) => first + index,
  );
  const focusedRow = Math.floor(focusedIndex / columns);
  if (focusedIndex >= 0 && !visible.includes(focusedRow))
    visible.push(focusedRow);
  return visible.sort((a, b) => a - b);
}
