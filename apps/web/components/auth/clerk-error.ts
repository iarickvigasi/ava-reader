type ClerkFieldError = {
  longMessage?: string | null;
  message?: string | null;
};

type ClerkErrors = {
  global?: Array<{ longMessage?: string | null; message?: string | null }> | null;
};

export function getClerkErrorMessage(
  fieldError?: ClerkFieldError | null,
  errors?: ClerkErrors,
  fallback?: string,
) {
  if (fieldError?.longMessage) {
    return fieldError.longMessage;
  }

  if (fieldError?.message) {
    return fieldError.message;
  }

  if (errors?.global?.[0]?.longMessage) {
    return errors.global[0].longMessage;
  }

  if (errors?.global?.[0]?.message) {
    return errors.global[0].message;
  }

  return fallback;
}
