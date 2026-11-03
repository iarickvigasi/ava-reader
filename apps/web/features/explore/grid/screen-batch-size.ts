export function screenBatchSize(input: {
  width: number;
  height: number;
  columns: number;
  top: number;
}) {
  const gap = 20;
  const cardWidth = (input.width - gap * (input.columns - 1)) / input.columns;
  const rowHeight = cardWidth * 1.5 + 100;
  const rows = Math.max(
    1,
    Math.floor(Math.max(0, input.height - input.top) / rowHeight),
  );
  return Math.min(40, Math.max(1, rows * input.columns));
}
