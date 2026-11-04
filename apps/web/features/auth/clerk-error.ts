type ClerkFieldError = { longMessage?: string | null; message?: string | null };
type ClerkErrors = { global?: ClerkFieldError[] | null };

export function getClerkErrorMessage(
  field?: ClerkFieldError | null,
  errors?: ClerkErrors,
  fallback?: string,
) {
  const global = errors?.global?.[0];
  return (
    field?.longMessage ||
    field?.message ||
    global?.longMessage ||
    global?.message ||
    fallback
  );
}
