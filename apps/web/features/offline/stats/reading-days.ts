// Calendar keys are labels, never instants. Keep this algorithm in sync with
// the other app's reading-days module; both run the same timezone regression cases.
export function dayKey(timestamp: number | Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatKey(formatter, timestamp);
}

// Inputs are credited whole-second intervals, not raw session wall-clock spans.
// Probe hourly, then locate a changed calendar date to the exact second. This
// avoids assuming a 24-hour day or a fixed UTC offset across a DST transition.
export function splitReadingDays(start: number, end: number, timeZone: string) {
  const seconds = new Map<string, number>();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return seconds;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const keyAt = (second: number) => formatKey(formatter, second * 1000);
  let cursor = Math.floor(start / 1000);
  const stop = Math.floor(end / 1000);
  while (cursor < stop) {
    const key = keyAt(cursor);
    let boundary = Math.min(cursor + 3600, stop);
    if (keyAt(boundary - 1) !== key) {
      let low = cursor + 1;
      let high = boundary - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (keyAt(middle) === key) low = middle + 1;
        else high = middle;
      }
      boundary = low;
    }
    seconds.set(key, (seconds.get(key) ?? 0) + boundary - cursor);
    cursor = boundary;
  }
  return seconds;
}

function formatKey(formatter: Intl.DateTimeFormat, timestamp: number | Date) {
  const parts = formatter.formatToParts(timestamp);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
