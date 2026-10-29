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
  const actions = grid.querySelector<HTMLElement>("[data-catalog-actions]");
  const actionsHeight = actions?.getBoundingClientRect().height ?? 0;
  return {
    columns,
    rowHeight: width * 1.5 + 144 + (actionsHeight ? actionsHeight + 12 : 0),
    top: box.top + window.scrollY,
    scroll: window.scrollY,
    height: window.innerHeight,
  };
}
