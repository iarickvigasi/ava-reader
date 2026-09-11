import { ANNOTATION_SOURCES, type AnnotationKind } from "./annotation-sources";

type LoadAnnotationsOptions = {
  kind: AnnotationKind;
  libraryItemId: string;
  apiBaseUrl: string;
  getToken: () => Promise<string | null>;
  online: boolean;
  signal: AbortSignal;
};

export async function loadAnnotations({
  kind, libraryItemId, apiBaseUrl, getToken, online, signal,
}: LoadAnnotationsOptions) {
  const source = ANNOTATION_SOURCES[kind];
  await source.hydrate(libraryItemId, apiBaseUrl);
  if (!online || signal.aborted) return;
  const token = await getToken();
  if (signal.aborted) return;
  if (!token) throw new Error("Annotation session unavailable");
  await source.flush(libraryItemId, apiBaseUrl);
  if (signal.aborted) return;
  const version = source.version(libraryItemId, apiBaseUrl);
  const response = await fetch(
    `${apiBaseUrl}/api/library/${encodeURIComponent(libraryItemId)}/${source.endpoint}`,
    { signal, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`Annotation load failed (${response.status})`);
  const data = await response.json() as { items?: unknown[] };
  // A delete acknowledgment or streamed response arriving during this GET
  // owns the newer state. Never replace it with an older server snapshot.
  if (!signal.aborted && source.version(libraryItemId, apiBaseUrl) === version) {
    source.apply(libraryItemId, apiBaseUrl, data.items ?? []);
  }
}
