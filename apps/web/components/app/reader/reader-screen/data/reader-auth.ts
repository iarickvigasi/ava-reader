// Auth precondition + bearer token resolution shared by every reader request.
// Centralising this avoids the same isLoaded/isSignedIn/getToken dance in
// each endpoint helper.

export type ReaderAuthInput = {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
};

// Resolves a bearer token, throwing if the user is not authenticated yet
// or if Clerk hasn't issued a token.
export async function resolveReaderAuthToken(
  input: ReaderAuthInput,
): Promise<string> {
  if (!input.isLoaded || !input.isSignedIn) {
    throw new Error("Reader access requires an authenticated session.");
  }

  const token = await input.getToken();

  if (!token) {
    throw new Error("No session token was available.");
  }

  return token;
}
