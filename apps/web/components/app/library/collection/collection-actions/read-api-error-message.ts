export function readApiErrorMessage(
  payload: { message?: string | string[] } | null,
  fallback: string,
) {
  if (!payload?.message) {
    return fallback;
  }

  if (Array.isArray(payload.message)) {
    return payload.message[0] ?? fallback;
  }

  return payload.message;
}
