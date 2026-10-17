import { observePdfImports } from "./pdf-imports/sync";
import { observeEpubImports } from "./epub-imports/sync";

export async function observeLibraryImports(
  getToken: () => Promise<string | null>,
) {
  // Failure of one format must not prevent the other format's status refresh.
  const results = await Promise.allSettled([
    observePdfImports(getToken),
    observeEpubImports(getToken),
  ]);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return results.some(
    (result) => result.status === "fulfilled" && result.value,
  );
}
