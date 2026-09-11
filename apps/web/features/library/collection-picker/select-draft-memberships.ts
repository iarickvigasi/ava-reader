export function selectDraftMemberships(
  memberships: ReadonlySet<string>,
  overrides: Readonly<Record<string, boolean>>,
) {
  const selected = new Set(memberships);
  for (const [id, checked] of Object.entries(overrides)) {
    if (checked) selected.add(id);
    else selected.delete(id);
  }
  return selected;
}
