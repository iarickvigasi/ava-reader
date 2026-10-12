// OpenRouter endpoint routing names include slash-separated provider variants.
// This content-free identifier is not a URL, path, header or credential.
export function isProviderEndpointSlug(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 100 &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.:-]*)*$/.test(
      value,
    ) &&
    value
      .split('/')
      .every((segment) => !/^(?:sk[-_]|bearer|https?:)/i.test(segment))
  );
}
