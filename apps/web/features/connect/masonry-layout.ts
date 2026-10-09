export const READER_CARD_MIN_WIDTH = 320;
export const READER_CARD_GAP = 16;

export function masonryColumns(width: number) {
  const count = Math.max(
    1,
    Math.floor(
      (width + READER_CARD_GAP) / (READER_CARD_MIN_WIDTH + READER_CARD_GAP),
    ),
  );
  return {
    count,
    cardWidth: (width - (count - 1) * READER_CARD_GAP) / count,
  };
}

export function masonryLayout(width: number, heights: number[]) {
  const { count, cardWidth } = masonryColumns(width);
  const bottoms = Array<number>(count).fill(0);
  const positions = heights.map((height) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const top = bottoms[column];
    bottoms[column] = top + height + READER_CARD_GAP;
    return { left: column * (cardWidth + READER_CARD_GAP), top };
  });
  return {
    positions,
    height: heights.length ? Math.max(...bottoms) - READER_CARD_GAP : 0,
  };
}
