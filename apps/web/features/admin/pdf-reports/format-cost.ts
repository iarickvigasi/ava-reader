export function formatUsdNano(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,39})$/.test(value))
    return "Unknown";
  const padded = value.padStart(10, "0");
  return `$${padded.slice(0, -9)}.${padded.slice(-9)} USD`;
}
