import type { Raw } from './types';

// Incoming claims only fill gaps. Explicit editorial clears are not gaps.
export function mergeMetadata(
  current: Raw | null,
  incoming: Raw,
  conflicts: string[],
  prefix = '',
  overrides: string[] = (current?.metadataOverrides as string[]) ?? [],
): Raw {
  const result: Raw = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null || value === '') continue;
    const field = `${prefix}${key}`;
    const before = current?.[key];
    if (overrides.includes(field)) {
      if (JSON.stringify(before) !== JSON.stringify(value))
        conflicts.push(field);
    } else if (Array.isArray(value)) {
      const allowed = (value as unknown[]).filter(
        (item) => !overrides.includes(`${field}:${String(item)}`),
      );
      result[key] = [
        ...new Set([
          ...(Array.isArray(before) ? (before as unknown[]) : []),
          ...allowed,
        ]),
      ];
      if (allowed.length !== value.length) conflicts.push(field);
    } else if (
      ['revision', 'categoryVersion', 'metadataIncomplete'].includes(key) &&
      !prefix
    ) {
      result[key] = value;
    } else if (
      before === undefined ||
      before === null ||
      before === '' ||
      before === 'UNKNOWN'
    ) {
      result[key] = value;
    } else if (JSON.stringify(before) !== JSON.stringify(value))
      conflicts.push(field);
  }
  return result;
}
