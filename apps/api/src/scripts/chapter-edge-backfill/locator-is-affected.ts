// Reject malformed locators rather than assume they cannot address removed content.
export function locatorIsAffected(
  locator: string | null,
  removed: Set<string>,
): boolean {
  if (!locator) return false;
  return visit(JSON.parse(locator) as unknown);

  function visit(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(visit);
    return Object.entries(value).some(([key, child]) =>
      key === 'chapterId' && typeof child === 'string'
        ? removed.has(child)
        : visit(child),
    );
  }
}
