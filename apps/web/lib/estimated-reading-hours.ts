const ESTIMATED_PAGES_PER_HOUR = 30;
export function estimatedReadingHours(pageCount: number) {
  return pageCount / ESTIMATED_PAGES_PER_HOUR;
}
