import { readApiErrorMessage } from "./read-api-error-message";

const FIELD_ERRORS = new Set([
  "nameEmpty",
  "nameTooLong",
  "nameDuplicate",
  "descriptionTooLong",
]);

export async function readCollectionError(
  response: Response,
  translate: (key: string) => string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string | string[];
  } | null;
  return payload?.code && FIELD_ERRORS.has(payload.code)
    ? translate(payload.code)
    : readApiErrorMessage(payload, translate("updateFailed"));
}
