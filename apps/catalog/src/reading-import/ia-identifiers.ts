export function iaIdentifiers(raw: Record<string, unknown>): string[] {
  const identifiers = raw.identifiers as Record<string, unknown> | undefined;
  const linked: unknown[] = Array.isArray(identifiers?.ia)
    ? (identifiers.ia as unknown[])
    : [];
  const values = [raw.ocaid, ...linked];
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' &&
          /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value),
      ),
    ),
  ];
}
