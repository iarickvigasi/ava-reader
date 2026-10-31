import { enqueueGenerate } from "./mutations";
import { expect, it, vi } from "vitest";
import {
  api,
  locator,
  intent,
  book,
  getAiCommentsBucket,
  setBucketAuth,
} from "./language-switch-fixture";
import { selectStableAiComments } from "./selectors";
import { selectSavedComments } from "@/components/app/reader/overlays/ai-toolbox/tool-item/saved-comments";
it.each([
  "generate.explain",
  "generate.etymology",
  "generate.translate",
] as const)(
  "%s keeps old-language chunks out of a new-language queued/streaming result",
  async (kind) => {
    let finishEnglish!: ReadableStreamDefaultController<Uint8Array>,
      finishUk!: ReadableStreamDefaultController<Uint8Array>;
    let startedEnglish!: () => void, startedUk!: () => void;
    const englishStarted = new Promise<void>((resolve) => {
      startedEnglish = resolve;
    });
    const ukStarted = new Promise<void>((resolve) => {
      startedUk = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, request: RequestInit) => {
        const body = JSON.parse(request.body as string) as {
          targetLang: string;
        };
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              if (body.targetLang === "English") {
                finishEnglish = controller;
                startedEnglish();
              } else {
                finishUk = controller;
                startedUk();
              }
            },
          }),
        );
      }),
    );
    const bucket = getAiCommentsBucket(book, api);
    await bucket.hydratedPromise;
    setBucketAuth(book, api, async () => "token");
    enqueueGenerate(book, api, intent(kind, "English", "en"));
    await englishStarted;
    enqueueGenerate(book, api, intent(kind, "Ukrainian", "uk"));
    expect(
      Object.values(
        selectSavedComments(
          selectStableAiComments(bucket),
          locator,
          "Ukrainian",
        ),
      )[0].status,
    ).toBe("queued");
    finishEnglish.enqueue(new TextEncoder().encode("English completion"));
    finishEnglish.close();
    await ukStarted;
    expect(
      Object.values(
        selectSavedComments(
          selectStableAiComments(bucket),
          locator,
          "Ukrainian",
        ),
      )[0],
    ).toMatchObject({ body: "", status: "streaming" });
    finishUk.enqueue(new TextEncoder().encode("Українська відповідь"));
    finishUk.close();
    await bucket.flushPromise;
    expect(
      Object.values(
        selectSavedComments(
          selectStableAiComments(bucket),
          locator,
          "Ukrainian",
        ),
      )[0],
    ).toMatchObject({ body: "Українська відповідь", status: "ready" });
  },
);
