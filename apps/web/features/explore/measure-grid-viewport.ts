export type GridViewport = {
  columns: number;
  rowHeight: number;
  top: number;
  scroll: number;
  height: number;
};

export function measureGridViewport(grid: HTMLElement): GridViewport | null {
  const box = grid.getBoundingClientRect();
  if (box.width <= 0) return null;
  const columns = getComputedStyle(grid)
    .gridTemplateColumns.trim()
    .split(/\s+/).length;
  const width = Math.min(246, (box.width - (columns - 1) * 20) / columns);
  return {
    columns,
    rowHeight: width * 1.5 + 144,
    top: box.top + window.scrollY,
    scroll: window.scrollY,
    height: window.innerHeight,
  };
}
