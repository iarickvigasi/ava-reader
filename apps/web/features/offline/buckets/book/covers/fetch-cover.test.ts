import { afterEach, expect, it, vi } from "vitest";
import { resolveApiAssetUrl } from "@/lib/api";
import { fetchCover } from "./fetch-cover";

afterEach(() => vi.unstubAllGlobals());

it("never sends a token to external artwork providers", async () => {
  const getToken = vi.fn().mockResolvedValue("secret");
  const fetch = vi.fn().mockResolvedValue(new Response("public"));
  vi.stubGlobal("fetch", fetch);
  await fetchCover("https://covers.example/book.jpg", getToken);
  expect(getToken).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith("https://covers.example/book.jpg", {
    cache: "no-store",
  });
});

it("requests private API covers with the current account token", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("private"));
  vi.stubGlobal("fetch", fetch);
  const src = resolveApiAssetUrl("/api/library/covers/private")!;
  await fetchCover(src, async () => "owner");
  expect(fetch).toHaveBeenCalledWith(src, {
    cache: "no-store",
    headers: { Authorization: "Bearer owner" },
  });
});
