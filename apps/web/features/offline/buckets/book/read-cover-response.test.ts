import { expect, it } from "vitest";
import { readCoverResponse } from "./read-cover-response";
it.each(["text/html", "image/svg+xml", "application/octet-stream"])(
  "refuses unsafe cover MIME %s",
  async (type) => {
    await expect(
      readCoverResponse(
        new Response("payload", { headers: { "Content-Type": type } }),
      ),
    ).rejects.toThrow("COVER_UNAVAILABLE");
  },
);
it.each(["209715201", "NaN", "-1", "4.5"])(
  "refuses invalid/oversized declared bytes %s",
  async (length) => {
    await expect(
      readCoverResponse(
        new Response("image", {
          headers: { "Content-Type": "image/png", "Content-Length": length },
        }),
      ),
    ).rejects.toThrow("COVER_UNAVAILABLE");
  },
);
it("refuses empty images and failed responses", async () => {
  await expect(
    readCoverResponse(
      new Response("", { headers: { "Content-Type": "image/png" } }),
    ),
  ).rejects.toThrow("COVER_UNAVAILABLE");
  await expect(
    readCoverResponse(new Response(null, { status: 404 })),
  ).rejects.toThrow("COVER_UNAVAILABLE");
});

it("cancels transport immediately when response metadata is refused", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    cancel: () => {
      cancelled = true;
    },
  });
  await expect(
    readCoverResponse(
      new Response(body, { headers: { "Content-Type": "text/html" } }),
    ),
  ).rejects.toThrow("COVER_UNAVAILABLE");
  expect(cancelled).toBe(true);
});
