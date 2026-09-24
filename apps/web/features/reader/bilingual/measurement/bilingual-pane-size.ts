export const BILINGUAL_COLUMN_GAP = 48;
export const BILINGUAL_PANE_GAP = 16;

export function bilingualPaneSize(
  width: number,
  height: number,
  stacked: boolean,
) {
  return {
    width: Math.max(
      0,
      Math.floor(stacked ? width : (width - BILINGUAL_COLUMN_GAP) / 2),
    ),
    height: Math.max(
      0,
      Math.floor(stacked ? (height - BILINGUAL_PANE_GAP) / 2 : height),
    ),
  };
}
