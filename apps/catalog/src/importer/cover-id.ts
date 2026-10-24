export function coverId(value: unknown): number | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.find((id): id is number => Number.isSafeInteger(id) && id > 0);
}
