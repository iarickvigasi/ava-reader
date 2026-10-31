import { expect, it } from "vitest";
import { narrationErrorState } from "./narration-error-state";
it.each([
  ["NotAllowedError", "ready"],
  ["NarrationAuthError", "auth"],
  ["NarrationProviderError", "provider"],
  ["TimeoutError", "timeout"],
])("distinguishes %s from connection failure", (name, state) => {
  const error = new Error();
  error.name = name;
  expect(narrationErrorState(error)).toBe(state);
});
