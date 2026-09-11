import * as highlights from "@/features/offline/buckets/highlights";
import * as comments from "@/features/offline/buckets/ai-comments";

type AnnotationSource = {
  endpoint: string;
  hydrate: (id: string, baseUrl: string) => Promise<void>;
  flush: (id: string, baseUrl: string) => Promise<void>;
  version: (id: string, baseUrl: string) => number;
  apply: (id: string, baseUrl: string, items: unknown[]) => void;
};

export const ANNOTATION_SOURCES: Record<"highlights" | "comments", AnnotationSource> = {
  highlights: {
    endpoint: "annotations",
    hydrate: (id, url) => highlights.getHighlightsBucket(id, url).hydratedPromise,
    flush: (id, url) => highlights.getHighlightsBucket(id, url).flushPromise
      ?? highlights.flushBucket(id, url),
    version: (id, url) => highlights.getHighlightsBucket(id, url).version,
    apply: (id, url, items) => {
      highlights.applyServerSnapshot(id, url, (items as highlights.ServerAnnotation[]).map(highlights.toHighlightRecord));
    },
  },
  comments: {
    endpoint: "ai-comments",
    hydrate: (id, url) => comments.getAiCommentsBucket(id, url).hydratedPromise,
    flush: (id, url) => comments.getAiCommentsBucket(id, url).flushPromise
      ?? comments.flushBucket(id, url),
    version: (id, url) => comments.getAiCommentsBucket(id, url).version,
    apply: (id, url, items) => comments.applyServerSnapshot(id, url, items as comments.ServerAiComment[]),
  },
};

export type AnnotationKind = keyof typeof ANNOTATION_SOURCES;
export type AnnotationLoadStatus = "loading" | "ready" | "error";
